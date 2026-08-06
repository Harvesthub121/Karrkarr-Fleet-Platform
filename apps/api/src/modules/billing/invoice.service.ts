/**
 * InvoiceService — generates, numbers, and manages invoice lifecycle.
 *
 * Key design decisions:
 *   - Invoice numbers are VP-INV-YYYY-NNNNNN, using a DB sequence via a
 *     raw SELECT nextval() inside the creating transaction to be collision-safe
 *     under concurrent requests. We create the sequence on first use via
 *     CREATE SEQUENCE IF NOT EXISTS.
 *   - appliedInterestRateBps + appliedGracePeriodDays are frozen at issue time
 *     so a policy change tomorrow cannot rewrite today's invoices.
 *   - billingAnchorDay determines the periodStart/End for WEEKLY and MONTHLY.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InvoiceStatus, BillingFrequency, LedgerEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import { LedgerService } from './ledger.service';
import { POLICY_KEYS } from '@vida/shared';

export interface GenerateInvoiceInput {
  rentalAgreementId: string;
  /** Period this invoice covers. */
  periodStart: Date;
  periodEnd: Date;
  issueDate: Date;
  createdBy?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private sequenceBootstrapped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly ledger: LedgerService,
  ) {}

  /** Ensure the invoice sequence exists. Called once at app startup or on first use. */
  private async ensureSequence(): Promise<void> {
    if (this.sequenceBootstrapped) return;
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS vida_invoice_seq START 1 INCREMENT 1`,
    );
    this.sequenceBootstrapped = true;
  }

  private async nextInvoiceNumber(year: number, tx: Prisma.TransactionClient): Promise<string> {
    const result = await tx.$queryRaw<[{ nextval: bigint }]>(
      Prisma.sql`SELECT nextval('vida_invoice_seq')`,
    );
    const seq = Number(result[0].nextval).toString().padStart(6, '0');
    return `VP-INV-${year}-${seq}`;
  }

  async generateInvoice(input: GenerateInvoiceInput): Promise<string> {
    await this.ensureSequence();

    return this.prisma.$transaction(async (tx) => {
      const rental = await tx.rentalAgreement.findUniqueOrThrow({
        where: { id: input.rentalAgreementId },
        include: { branch: true },
      });

      // Prevent duplicate invoices for the same period
      const existing = await tx.invoice.findFirst({
        where: {
          rentalAgreementId: input.rentalAgreementId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: { notIn: ['CANCELLED'] },
        },
      });
      if (existing) {
        this.logger.warn(
          `Invoice already exists for rental ${input.rentalAgreementId} period ${input.periodStart.toISOString()}`,
        );
        return existing.id;
      }

      // Freeze policy at issue time — changing the rate tomorrow must not affect this invoice
      const interestRateBps = await this.policy.get(POLICY_KEYS.INTEREST_RATE_BPS, {
        branchId: rental.branchId,
        rentalId: rental.id,
      });
      const gracePeriodDays = await this.policy.get(POLICY_KEYS.GRACE_PERIOD_DAYS, {
        branchId: rental.branchId,
        rentalId: rental.id,
      });
      const paymentTermDays = await this.policy.get(POLICY_KEYS.INVOICE_PAYMENT_TERM_DAYS, {
        branchId: rental.branchId,
      });

      const dueDate = new Date(input.issueDate);
      dueDate.setDate(dueDate.getDate() + Number(paymentTermDays));

      const year = input.issueDate.getFullYear();
      const invoiceNo = await this.nextInvoiceNumber(year, tx);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          rentalAgreementId: rental.id,
          customerId: rental.customerId,
          branchId: rental.branchId,
          status: 'UPCOMING',
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          issueDate: input.issueDate,
          dueDate,
          principalCents: rental.rentAmountCents,
          outstandingCents: rental.rentAmountCents,
          appliedInterestRateBps: Number(interestRateBps),
          appliedGracePeriodDays: Number(gracePeriodDays),
        },
      });

      // Create the invoice line
      await tx.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          description: `Rental charge ${input.periodStart.toISOString().slice(0, 10)} to ${input.periodEnd.toISOString().slice(0, 10)}`,
          quantity: 1,
          unitPriceCents: rental.rentAmountCents,
          amountCents: rental.rentAmountCents,
          sortOrder: 1,
        },
      });

      // Write the RENTAL_CHARGE ledger entry
      await this.ledger.write({
        customerId: rental.customerId,
        rentalAgreementId: rental.id,
        invoiceId: invoice.id,
        type: LedgerEntryType.RENTAL_CHARGE,
        amountCents: rental.rentAmountCents,
        description: `Rental charge: ${invoiceNo}`,
        effectiveDate: input.issueDate,
        idempotencyKey: `rental_charge:${invoice.id}`,
        createdBy: input.createdBy,
        tx,
      });

      return invoice.id;
    });
  }

  async cancelInvoice(
    invoiceId: string,
    reason: string,
    cancelledBy: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });

    const cancellableStatuses: InvoiceStatus[] = ['UPCOMING', 'DUE'];
    if (!cancellableStatuses.includes(invoice.status)) {
      throw new BadRequestException(
        `Cannot cancel invoice in status ${invoice.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      // Reverse the rental charge so the ledger stays balanced
      await this.ledger.write({
        customerId: invoice.customerId,
        rentalAgreementId: invoice.rentalAgreementId,
        invoiceId: invoice.id,
        type: LedgerEntryType.CREDIT_NOTE,
        amountCents: -invoice.principalCents,
        description: `Cancellation of ${invoice.invoiceNo}: ${reason}`,
        effectiveDate: new Date(),
        idempotencyKey: `cancel:${invoice.id}`,
        createdBy: cancelledBy,
        tx,
      });

      await tx.auditLog.create({
        data: {
          actorAdminId: cancelledBy,
          actorType: 'ADMIN',
          action: 'invoice.cancel',
          entityType: 'Invoice',
          entityId: invoiceId,
          after: { reason },
        },
      });
    });
  }

  async writeOffInvoice(
    invoiceId: string,
    reason: string,
    writtenOffBy: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });

    const writeOffableStatuses: InvoiceStatus[] = ['DUE', 'OVERDUE', 'PARTIALLY_PAID'];
    if (!writeOffableStatuses.includes(invoice.status)) {
      throw new BadRequestException(
        `Cannot write off invoice in status ${invoice.status}`,
      );
    }

    const outstanding = invoice.outstandingCents;
    if (outstanding <= 0n) {
      throw new BadRequestException('Invoice has no outstanding balance to write off');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'WRITTEN_OFF', writtenOffAt: new Date() },
      });

      await this.ledger.write({
        customerId: invoice.customerId,
        rentalAgreementId: invoice.rentalAgreementId,
        invoiceId: invoice.id,
        type: LedgerEntryType.WRITE_OFF,
        amountCents: -outstanding,
        description: `Write-off of ${invoice.invoiceNo}: ${reason}`,
        effectiveDate: new Date(),
        idempotencyKey: `writeoff:${invoice.id}`,
        createdBy: writtenOffBy,
        tx,
      });

      await tx.auditLog.create({
        data: {
          actorAdminId: writtenOffBy,
          actorType: 'ADMIN',
          action: 'invoice.write_off',
          entityType: 'Invoice',
          entityId: invoiceId,
          after: { reason, amountCents: outstanding.toString() },
        },
      });
    });
  }

  /**
   * Compute the next billing periods for a rental that need invoices generated.
   * Used by InvoiceGenerationJob.
   */
  computeNextPeriod(
    billingFrequency: BillingFrequency,
    billingAnchorDay: number,
    afterDate: Date,
  ): { periodStart: Date; periodEnd: Date } {
    if (billingFrequency === 'WEEKLY') {
      // billingAnchorDay = 1 (Mon) through 7 (Sun)
      const d = new Date(afterDate);
      // Find the next occurrence of the anchor day-of-week
      const targetDow = billingAnchorDay === 7 ? 0 : billingAnchorDay; // JS: 0=Sun
      const currentDow = d.getDay();
      const daysUntil = (targetDow - currentDow + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntil);
      const periodStart = new Date(d);
      const periodEnd = new Date(d);
      periodEnd.setDate(periodEnd.getDate() + 6);
      return { periodStart, periodEnd };
    } else {
      // MONTHLY — billingAnchorDay is day-of-month, capped at 28
      const anchorDay = Math.min(billingAnchorDay, 28);
      const d = new Date(afterDate);
      let year = d.getFullYear();
      let month = d.getMonth();
      // If we're past the anchor day this month, move to next month
      if (d.getDate() >= anchorDay) {
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      const periodStart = new Date(year, month, anchorDay);
      const periodEnd = new Date(year, month + 1, anchorDay - 1);
      return { periodStart, periodEnd };
    }
  }
}
