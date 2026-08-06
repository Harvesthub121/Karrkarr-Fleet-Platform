/**
 * PaymentSubmissionService — the "I've Made Payment" workflow.
 *
 * Workflow:
 *   1. Customer submits: uploads optional proof + mandatory txn reference.
 *      Invoice -> PENDING_VERIFICATION. Admin notified.
 *   2. Admin approves: creates Payment + PAYMENT_RECEIVED ledger entry.
 *      Generates receipt PDF + receipt number KR-RCP-YYYY-NNNNNN.
 *      Invoice -> PAID or PARTIALLY_PAID (if approvedAmount < outstanding).
 *      Customer emailed confirmation with receipt PDF.
 *   3. Admin rejects: reason required. Invoice returns to its prior status.
 *      Customer emailed rejection reason.
 *
 * Receipt numbering uses the same collision-safe nextval() approach as invoices.
 * Partial payment: if approvedAmountCents < outstanding, invoice stays
 * PARTIALLY_PAID and interest continues to accrue on the remaining principal.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { LedgerEntryType, PaymentMethod, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../billing/ledger.service';
import { S3Service } from '../documents/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { formatSgd } from '@karrkarr/shared';
import * as PDFDocument from 'pdfkit';

export interface SubmitPaymentDto {
  invoiceId: string;
  customerId: string;
  declaredAmountCents: bigint;
  transactionRef: string;
  paidOnDate: Date;
  proofBuffer?: Buffer;
  proofMimeType?: string;
  customerNote?: string;
  method?: PaymentMethod;
}

export interface ApprovePaymentDto {
  submissionId: string;
  approvedAmountCents: bigint;
  adminId: string;
  notes?: string;
}

export interface RejectPaymentDto {
  submissionId: string;
  rejectionReason: string;
  adminId: string;
}

@Injectable()
export class PaymentSubmissionService {
  private readonly logger = new Logger(PaymentSubmissionService.name);
  private receiptSequenceBootstrapped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly s3: S3Service,
    private readonly notifications: NotificationService,
  ) {}

  private async ensureReceiptSequence(): Promise<void> {
    if (this.receiptSequenceBootstrapped) return;
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS karrkarr_receipt_seq START 1 INCREMENT 1`,
    );
    this.receiptSequenceBootstrapped = true;
  }

  private async nextReceiptNumber(
    year: number,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const result = await tx.$queryRaw<[{ nextval: bigint }]>(
      Prisma.sql`SELECT nextval('karrkarr_receipt_seq')`,
    );
    const seq = Number(result[0].nextval).toString().padStart(6, '0');
    return `KR-RCP-${year}-${seq}`;
  }

  async submitPayment(dto: SubmitPaymentDto): Promise<{ submissionId: string }> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: dto.invoiceId },
      select: {
        id: true,
        invoiceNo: true,
        customerId: true,
        branchId: true,
        status: true,
        outstandingCents: true,
      },
    });

    if (invoice.customerId !== dto.customerId) {
      throw new ForbiddenException('Invoice does not belong to this customer');
    }

    const submittableStatuses: InvoiceStatus[] = ['DUE', 'OVERDUE', 'PARTIALLY_PAID', 'REJECTED'];
    if (!submittableStatuses.includes(invoice.status)) {
      throw new BadRequestException(
        `Cannot submit payment for invoice in status ${invoice.status}`,
      );
    }

    let proofS3Key: string | undefined;
    if (dto.proofBuffer) {
      proofS3Key = `payment-proof/${dto.invoiceId}/${Date.now()}.${dto.proofMimeType?.split('/')[1] ?? 'jpg'}`;
      await this.s3.upload({
        key: proofS3Key,
        body: dto.proofBuffer,
        contentType: dto.proofMimeType ?? 'image/jpeg',
      });
    }

    const submission = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.paymentSubmission.create({
        data: {
          invoiceId: dto.invoiceId,
          customerId: dto.customerId,
          status: 'PENDING_VERIFICATION',
          method: dto.method ?? 'PAYNOW',
          declaredAmountCents: dto.declaredAmountCents,
          transactionRef: dto.transactionRef,
          paidOnDate: dto.paidOnDate,
          proofS3Key,
          customerNote: dto.customerNote,
        },
      });

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: { status: 'PENDING_VERIFICATION' },
      });

      return sub;
    });

    // Notify admin via in-app + email
    await this.notifications.fanOutToAdmins({
      branchId: invoice.branchId,
      eventType: 'payment.submitted',
      title: `Payment Submitted – ${invoice.invoiceNo}`,
      body: `Customer has submitted payment of ${formatSgd(dto.declaredAmountCents)} for ${invoice.invoiceNo}. Ref: ${dto.transactionRef}`,
      actionUrl: `/admin/payments/verify/${submission.id}`,
      severity: 'info',
      metadata: { submissionId: submission.id, invoiceId: dto.invoiceId },
    });

    return { submissionId: submission.id };
  }

  async approvePayment(dto: ApprovePaymentDto): Promise<{ paymentId: string }> {
    await this.ensureReceiptSequence();

    const submission = await this.prisma.paymentSubmission.findUniqueOrThrow({
      where: { id: dto.submissionId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            customerId: true,
            rentalAgreementId: true,
            branchId: true,
            status: true,
            outstandingCents: true,
            principalCents: true,
          },
        },
        customer: { select: { email: true, fullName: true } },
      },
    });

    if (submission.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException(`Submission is already ${submission.status}`);
    }

    if (dto.approvedAmountCents <= 0n) {
      throw new BadRequestException('Approved amount must be positive');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const receiptNo = await this.nextReceiptNumber(year, tx);

      // Generate PDF receipt
      const receiptPdf = await this.generateReceiptPdf(receiptNo, submission, dto.approvedAmountCents);
      const receiptS3Key = `receipts/${receiptNo}.pdf`;
      await this.s3.upload({
        key: receiptS3Key,
        body: receiptPdf,
        contentType: 'application/pdf',
      });

      // Create Payment record
      const pmt = await tx.payment.create({
        data: {
          receiptNo,
          invoiceId: submission.invoiceId,
          submissionId: submission.id,
          amountCents: dto.approvedAmountCents,
          method: submission.method,
          transactionRef: submission.transactionRef,
          receivedOn: submission.paidOnDate,
          recordedById: dto.adminId,
          receiptS3Key,
          notes: dto.notes,
        },
      });

      // Mark submission as approved
      await tx.paymentSubmission.update({
        where: { id: dto.submissionId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: dto.adminId,
          approvedAmountCents: dto.approvedAmountCents,
        },
      });

      // Write PAYMENT_RECEIVED ledger entry (negative = reduces what customer owes)
      await this.ledger.write({
        customerId: submission.invoice.customerId,
        rentalAgreementId: submission.invoice.rentalAgreementId ?? undefined,
        invoiceId: submission.invoice.id,
        type: LedgerEntryType.PAYMENT_RECEIVED,
        amountCents: -dto.approvedAmountCents,
        description: `Payment received – Receipt ${receiptNo}`,
        effectiveDate: submission.paidOnDate,
        idempotencyKey: `payment:${pmt.id}`,
        createdBy: dto.adminId,
        tx,
      });

      // Determine new invoice status after payment
      const outstanding = submission.invoice.outstandingCents - dto.approvedAmountCents;
      let newStatus: InvoiceStatus;
      if (outstanding <= 0n) {
        newStatus = 'PAID';
      } else {
        // Partial payment — interest continues on remaining principal
        newStatus = 'PARTIALLY_PAID';
      }

      await tx.invoice.update({
        where: { id: submission.invoice.id },
        data: {
          status: newStatus,
          ...(newStatus === 'PAID' ? { paidAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorAdminId: dto.adminId,
          actorType: 'ADMIN',
          action: 'payment.approve',
          entityType: 'PaymentSubmission',
          entityId: submission.id,
          after: {
            approvedAmountCents: dto.approvedAmountCents.toString(),
            receiptNo,
            invoiceStatus: newStatus,
          },
        },
      });

      return pmt;
    });

    // Notify customer
    await this.notifications.notifyCustomer({
      customerId: submission.customerId,
      eventType: 'payment.approved',
      title: 'Payment Confirmed',
      body: `Your payment of ${formatSgd(dto.approvedAmountCents)} for invoice ${submission.invoice.invoiceNo} has been verified. Receipt: ${payment.receiptNo}.`,
      actionUrl: `/portal/receipts/${payment.id}`,
      severity: 'info',
      metadata: { paymentId: payment.id, receiptNo: payment.receiptNo },
    });

    return { paymentId: payment.id };
  }

  async rejectPayment(dto: RejectPaymentDto): Promise<void> {
    if (!dto.rejectionReason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const submission = await this.prisma.paymentSubmission.findUniqueOrThrow({
      where: { id: dto.submissionId },
      include: {
        invoice: { select: { id: true, invoiceNo: true, dueDate: true, status: true } },
      },
    });

    if (submission.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException(`Submission is already ${submission.status}`);
    }

    // Restore prior invoice status
    const priorStatus: InvoiceStatus =
      new Date() > submission.invoice.dueDate ? 'OVERDUE' : 'DUE';

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentSubmission.update({
        where: { id: dto.submissionId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedById: dto.adminId,
          rejectionReason: dto.rejectionReason,
        },
      });

      await tx.invoice.update({
        where: { id: submission.invoiceId },
        data: { status: priorStatus },
      });

      await tx.auditLog.create({
        data: {
          actorAdminId: dto.adminId,
          actorType: 'ADMIN',
          action: 'payment.reject',
          entityType: 'PaymentSubmission',
          entityId: submission.id,
          after: { rejectionReason: dto.rejectionReason },
        },
      });
    });

    // Notify customer of rejection
    await this.notifications.notifyCustomer({
      customerId: submission.customerId,
      eventType: 'payment.rejected',
      title: 'Payment Not Verified',
      body: `Your payment submission for ${submission.invoice.invoiceNo} was not verified. Reason: ${dto.rejectionReason}. Please resubmit with the correct details.`,
      actionUrl: `/portal/invoices/${submission.invoiceId}`,
      severity: 'warning',
      metadata: { submissionId: submission.id, reason: dto.rejectionReason },
    });
  }

  private async generateReceiptPdf(
    receiptNo: string,
    submission: any,
    approvedAmountCents: bigint,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(20)
        .text('KARRKARR PTE LTD', { align: 'center' })
        .moveDown(0.5)
        .fontSize(14)
        .text('OFFICIAL RECEIPT', { align: 'center' })
        .moveDown(1);

      doc.fontSize(11);
      doc.text(`Receipt No: ${receiptNo}`);
      doc.text(`Date: ${new Date().toLocaleDateString('en-SG')}`);
      doc.moveDown(0.5);
      doc.text(`Invoice No: ${submission.invoice.invoiceNo}`);
      doc.text(`Customer: ${submission.customer.fullName}`);
      doc.moveDown(0.5);
      doc.text(`Amount Received: ${formatSgd(approvedAmountCents)}`);
      doc.text(`Payment Method: ${submission.method}`);
      doc.text(`Transaction Reference: ${submission.transactionRef}`);
      doc.text(`Paid On: ${submission.paidOnDate.toLocaleDateString('en-SG')}`);
      doc.moveDown(1);
      doc
        .fontSize(9)
        .text(
          'This is a computer-generated receipt and does not require a signature.',
          { align: 'center' },
        );

      doc.end();
    });
  }
}
