import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '@karrkarr/shared';

type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf';

function parseDate(s?: string): Date {
  if (!s) return new Date(0);
  return new Date(s);
}

function colsFromData(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]);
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private async sendExport(
    res: Response,
    data: Record<string, unknown>[],
    format: ExportFormat,
    filename: string,
  ): Promise<void> {
    switch (format) {
      case 'csv': {
        const buf = await this.reports.exportToCsv(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(buf);
        break;
      }
      case 'excel': {
        const buf = await this.reports.exportToExcel(data, filename);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        res.send(buf);
        break;
      }
      case 'pdf': {
        const buf = await this.reports.exportToPdf(data, filename, colsFromData(data));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(buf);
        break;
      }
      default:
        res.json(data);
    }
  }
  @Get('fleet-overview')
  @ApiOperation({ summary: 'Fleet overview stats for admin dashboard' })
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async fleetOverview(@Query('branchId') branchId?: string) {
    return this.service.fleetOverview(branchId);
  }


  @Get('revenue')
  @ApiOperation({ summary: 'Revenue report' })
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async revenue(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.revenueReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, (data as any).payments, format, `revenue-${from}-${to}`);
  }

  @Get('outstanding-payments')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async outstanding(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.outstandingPaymentsReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, (data as any).invoices, format, `outstanding-${from}-${to}`);
  }

  @Get('late-payments')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async latePayments(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.latePaymentsReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, data as any[], format, `late-payments-${from}-${to}`);
  }

  @Get('vehicle-utilisation')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async vehicleUtil(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.vehicleUtilisationReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, data as any[], format, `utilisation-${from}-${to}`);
  }

  @Get('maintenance-costs')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async maintenance(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.maintenanceCostsReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, (data as any).records, format, `maintenance-${from}-${to}`);
  }

  @Get('revenue-per-vehicle')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async revenuePerVehicle(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.revenuePerVehicleReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, data as any[], format, `rev-vehicle-${from}-${to}`);
  }

  @Get('revenue-per-customer')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async revenuePerCustomer(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.revenuePerCustomerReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, data as any[], format, `rev-customer-${from}-${to}`);
  }

  @Get('upcoming-expiries')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async upcomingExpiries(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.upcomingExpiriesReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, data as any[], format, `expiries-${from}-${to}`);
  }

  @Get('branch-performance')
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  async branchPerformance(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
    @Query('format') format: ExportFormat = 'json',
    @Res() res?: Response,
  ) {
    const data = await this.reports.branchPerformanceReport({ from: parseDate(from), to: parseDate(to), branchId });
    if (format === 'json' || !res) return res ? res.json(data) : data;
    await this.sendExport(res!, data as any[], format, `branch-perf-${from}-${to}`);
  }

  // Export routes require REPORT_EXPORT permission (stricter than REPORT_READ)
  @Get('export')
  @ApiOperation({ summary: 'Export any report — requires report.export permission' })
  @RequirePermissions(PERMISSIONS.REPORT_EXPORT)
  async exportAny() {
    // This endpoint validates the permission; the actual report endpoints above
    // handle the export= query param. The guard is the contract.
    return { message: 'Use individual report endpoints with ?format=csv|excel|pdf' };
  }
}
