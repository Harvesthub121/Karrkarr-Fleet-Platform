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
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { InterestService } from './interest.service';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '@vida/shared';
import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class CancelInvoiceDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

class WriteOffInvoiceDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

class WaiveInterestDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  amountCents: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

class InvoiceQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;
}

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly interestService: InterestService,
    private readonly ledgerService: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Invoices ────────────────────────────────────────────────────────────────

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices with filters' })
  @RequirePermissions(PERMISSIONS.INVOICE_READ)
  async listInvoices(@Query() query: InvoiceQueryDto) {
    const where: any = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.branchId) where.branchId = query.branchId;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dueDate: 'desc' },
        include: {
          customer: { select: { fullName: true, customerRef: true } },
          lines: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice detail' })
  @RequirePermissions(PERMISSIONS.INVOICE_READ)
  async getInvoice(@Param('id') id: string) {
    return this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: {
        lines: true,
        ledgerEntries: { orderBy: { effectiveDate: 'asc' } },
        submissions: { orderBy: { submittedAt: 'desc' } },
        payments: true,
        reminders: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  @Patch('invoices/:id/cancel')
  @ApiOperation({ summary: 'Cancel an UPCOMING or DUE invoice' })
  @RequirePermissions(PERMISSIONS.INVOICE_CANCEL)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvoice(
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.invoiceService.cancelInvoice(id, dto.reason, user.id);
  }

  @Patch('invoices/:id/write-off')
  @ApiOperation({ summary: 'Write off an overdue invoice balance' })
  @RequirePermissions(PERMISSIONS.WRITE_OFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  async writeOffInvoice(
    @Param('id') id: string,
    @Body() dto: WriteOffInvoiceDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.invoiceService.writeOffInvoice(id, dto.reason, user.id);
  }

  // ── Interest ────────────────────────────────────────────────────────────────

  @Post('invoices/:id/interest/waive')
  @ApiOperation({ summary: 'Waive interest on an invoice (requires interest.waive)' })
  @RequirePermissions(PERMISSIONS.INTEREST_WAIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async waiveInterest(
    @Param('id') id: string,
    @Body() dto: WaiveInterestDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.interestService.waiveInterest(id, BigInt(dto.amountCents), dto.reason, user.id);
  }

  // ── Ledger ──────────────────────────────────────────────────────────────────

  @Get('ledger/:customerId')
  @ApiOperation({ summary: 'Customer ledger entries' })
  @RequirePermissions(PERMISSIONS.LEDGER_READ)
  async getLedger(
    @Param('customerId') customerId: string,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 50,
  ) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { customerId },
        skip,
        take: pageSize,
        orderBy: { effectiveDate: 'desc' },
      }),
      this.prisma.ledgerEntry.count({ where: { customerId } }),
    ]);
    return { data, page, pageSize, total };
  }
}
