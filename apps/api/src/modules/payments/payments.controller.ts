import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { PayNowService } from './paynow.service';
import { PaymentSubmissionService } from './payment-submission.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '@karrkarr/shared';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

class SubmitPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  declaredAmountCents: number;

  @IsString()
  @IsNotEmpty()
  transactionRef: string;

  @IsDateString()
  paidOnDate: string;

  @IsOptional()
  @IsString()
  customerNote?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

class ApprovePaymentDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  approvedAmountCents: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class RejectPaymentDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payNow: PayNowService,
    private readonly submissions: PaymentSubmissionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('invoices/:invoiceId/paynow-qr')
  @ApiOperation({ summary: 'Get PayNow QR for an invoice (data-URI PNG)' })
  @RequirePermissions(PERMISSIONS.INVOICE_READ)
  async getPayNowQr(@Param('invoiceId') invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { invoiceNo: true, outstandingCents: true },
    });
    const qrDataUri = await this.payNow.generateInvoiceQr(
      invoice.invoiceNo,
      invoice.outstandingCents,
    );
    return { invoiceNo: invoice.invoiceNo, qrDataUri };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Customer submits payment claim' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('proof'))
  @RequirePermissions(PERMISSIONS.INVOICE_READ)
  async submitPayment(
    @Body() dto: SubmitPaymentDto,
    @CurrentUser() user: { id: string },
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    return this.submissions.submitPayment({
      invoiceId: dto.invoiceId,
      customerId: user.id,
      declaredAmountCents: BigInt(dto.declaredAmountCents),
      transactionRef: dto.transactionRef,
      paidOnDate: new Date(dto.paidOnDate),
      proofBuffer: proof?.buffer,
      proofMimeType: proof?.mimetype,
      customerNote: dto.customerNote,
      method: dto.method,
    });
  }

  @Get('submissions')
  @ApiOperation({ summary: 'List payment submissions (admin)' })
  @RequirePermissions(PERMISSIONS.PAYMENT_VERIFY)
  async listSubmissions(
    @Query('status') status?: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    const where: any = {};
    if (status) where.status = status;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.paymentSubmission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { submittedAt: 'desc' },
        include: {
          customer: { select: { fullName: true, customerRef: true, email: true } },
          invoice: { select: { invoiceNo: true, outstandingCents: true } },
          reviewedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.paymentSubmission.count({ where }),
    ]);
    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  @Post('submissions/:id/approve')
  @ApiOperation({ summary: 'Admin approves a payment submission' })
  @RequirePermissions(PERMISSIONS.PAYMENT_VERIFY)
  async approvePayment(
    @Param('id') id: string,
    @Body() dto: ApprovePaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissions.approvePayment({
      submissionId: id,
      approvedAmountCents: BigInt(dto.approvedAmountCents),
      adminId: user.id,
      notes: dto.notes,
    });
  }

  @Post('submissions/:id/reject')
  @ApiOperation({ summary: 'Admin rejects a payment submission' })
  @RequirePermissions(PERMISSIONS.PAYMENT_VERIFY)
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectPayment(
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.submissions.rejectPayment({
      submissionId: id,
      rejectionReason: dto.rejectionReason,
      adminId: user.id,
    });
  }

  @Get('receipts/:id/download')
  @ApiOperation({ summary: 'Download receipt PDF' })
  @RequirePermissions(PERMISSIONS.INVOICE_READ)
  async downloadReceipt(@Param('id') id: string, @Res() res: Response) {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id },
      select: { receiptNo: true, receiptS3Key: true },
    });

    if (!payment.receiptS3Key) {
      res.status(404).json({ message: 'Receipt PDF not available' });
      return;
    }

    // S3Service should have a getSignedUrl method — serve via redirect
    // In production, redirect to a presigned URL; here we just return the key info
    res.json({ receiptNo: payment.receiptNo, s3Key: payment.receiptS3Key });
  }
}
