/**
 * ReportsService — all 9 report types with date-range + branch filters.
 * Export functions produce Buffer outputs consumed by the controller.
 *
 * Uses:
 *   - exceljs for Excel (.xlsx)
 *   - pdfkit for PDF
 * CSV is produced by simple string serialisation (no extra dependency).
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { formatSgd } from '@karrkarr/shared';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

export interface ReportFilter {
  from: Date;
  to: Date;
  branchId?: string;
}

function safeCents(v: bigint | null | undefined): number {
  return Number(v ?? 0n);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Revenue Report ───────────────────────────────────────────────────────
  async revenueReport(filter: ReportFilter) {
    const payments = await this.prisma.payment.findMany({
      where: {
        receivedOn: { gte: filter.from, lte: filter.to },
        ...(filter.branchId
          ? { invoice: { branchId: filter.branchId } }
          : {}),
      },
      include: {
        invoice: { select: { branchId: true, invoiceNo: true } },
      },
      orderBy: { receivedOn: 'asc' },
    });

    const total = payments.reduce((s, p) => s + p.amountCents, 0n);
    return {
      period: { from: filter.from, to: filter.to },
      branchId: filter.branchId,
      payments: payments.map((p) => ({
        receiptNo: p.receiptNo,
        invoiceNo: p.invoice.invoiceNo,
        amountCents: safeCents(p.amountCents),
        amountDisplay: formatSgd(p.amountCents),
        method: p.method,
        receivedOn: p.receivedOn.toISOString().slice(0, 10),
      })),
      totalCents: safeCents(total),
      totalDisplay: formatSgd(total),
    };
  }

  // ── 2. Outstanding Payments Report ─────────────────────────────────────────
  async outstandingPaymentsReport(filter: ReportFilter) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
        dueDate: { lte: filter.to },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: {
        customer: { select: { fullName: true, customerRef: true } },
        rental: { select: { vehicle: { select: { plateNumber: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const total = invoices.reduce((s, i) => s + i.outstandingCents, 0n);
    return {
      invoices: invoices.map((i) => ({
        invoiceNo: i.invoiceNo,
        customerName: i.customer.fullName,
        customerRef: i.customer.customerRef,
        plateNumber: i.rental.vehicle.plateNumber,
        dueDate: i.dueDate.toISOString().slice(0, 10),
        outstandingCents: safeCents(i.outstandingCents),
        outstandingDisplay: formatSgd(i.outstandingCents),
        status: i.status,
      })),
      totalCents: safeCents(total),
      totalDisplay: formatSgd(total),
    };
  }

  // ── 3. Late Payments Report ─────────────────────────────────────────────────
  async latePaymentsReport(filter: ReportFilter) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['OVERDUE', 'PARTIALLY_PAID', 'PAID'] },
        dueDate: { gte: filter.from, lte: filter.to },
        interestAccruedCents: { gt: 0n },
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
      },
      include: {
        customer: { select: { fullName: true, customerRef: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return invoices.map((i) => ({
      invoiceNo: i.invoiceNo,
      customerName: i.customer.fullName,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      principalCents: safeCents(i.principalCents),
      interestAccruedCents: safeCents(i.interestAccruedCents),
      interestWaivedCents: safeCents(i.interestWaivedCents),
      status: i.status,
    }));
  }

  // ── 4. Vehicle Utilisation Report ───────────────────────────────────────────
  async vehicleUtilisationReport(filter: ReportFilter) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...(filter.branchId ? { branchId: filter.branchId } : {}) },
      include: {
        rentals: {
          where: {
            startDate: { lte: filter.to },
            endDate: { gte: filter.from },
            status: { not: 'CANCELLED' },
          },
          select: { startDate: true, endDate: true },
        },
      },
    });

    const totalDays = Math.round((filter.to.getTime() - filter.from.getTime()) / 86_400_000);

    return vehicles.map((v) => {
      const rentedDays = v.rentals.reduce((sum, r) => {
        const start = r.startDate < filter.from ? filter.from : r.startDate;
        const end = r.endDate > filter.to ? filter.to : r.endDate;
        return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
      }, 0);
      return {
        plateNumber: v.plateNumber,
        make: v.make,
        model: v.model,
        totalDays,
        rentedDays,
        utilisationPct: totalDays > 0 ? Math.round((rentedDays / totalDays) * 100) : 0,
      };
    });
  }

  // ── 5. Maintenance Costs Report ─────────────────────────────────────────────
  async maintenanceCostsReport(filter: ReportFilter) {
    const records = await this.prisma.maintenanceRecord.findMany({
      where: {
        serviceDate: { gte: filter.from, lte: filter.to },
        ...(filter.branchId
          ? { vehicle: { branchId: filter.branchId } }
          : {}),
      },
      include: { vehicle: { select: { plateNumber: true, make: true, model: true } } },
      orderBy: { serviceDate: 'asc' },
    });

    const total = records.reduce((s, r) => s + r.costCents, 0n);
    return {
      records: records.map((r) => ({
        plateNumber: r.vehicle.plateNumber,
        make: r.vehicle.make,
        model: r.vehicle.model,
        type: r.type,
        serviceDate: r.serviceDate.toISOString().slice(0, 10),
        costCents: safeCents(r.costCents),
        costDisplay: formatSgd(r.costCents),
        rechargedToCustomer: r.rechargedToCustomer,
      })),
      totalCents: safeCents(total),
      totalDisplay: formatSgd(total),
    };
  }

  // ── 6. Revenue Per Vehicle ──────────────────────────────────────────────────
  async revenuePerVehicleReport(filter: ReportFilter) {
    const payments = await this.prisma.payment.findMany({
      where: {
        receivedOn: { gte: filter.from, lte: filter.to },
        ...(filter.branchId ? { invoice: { branchId: filter.branchId } } : {}),
      },
      include: {
        invoice: {
          include: { rental: { select: { vehicle: { select: { plateNumber: true, make: true, model: true } } } } },
        },
      },
    });

    const byVehicle: Record<string, { plateNumber: string; make: string; model: string; totalCents: bigint }> = {};
    for (const p of payments) {
      const plate = p.invoice.rental.vehicle.plateNumber;
      if (!byVehicle[plate]) {
        byVehicle[plate] = {
          plateNumber: plate,
          make: p.invoice.rental.vehicle.make,
          model: p.invoice.rental.vehicle.model,
          totalCents: 0n,
        };
      }
      byVehicle[plate].totalCents += p.amountCents;
    }

    return Object.values(byVehicle)
      .map((v) => ({ ...v, totalCents: safeCents(v.totalCents), totalDisplay: formatSgd(v.totalCents) }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }

  // ── 7. Revenue Per Customer ─────────────────────────────────────────────────
  async revenuePerCustomerReport(filter: ReportFilter) {
    const payments = await this.prisma.payment.findMany({
      where: {
        receivedOn: { gte: filter.from, lte: filter.to },
        ...(filter.branchId ? { invoice: { branchId: filter.branchId } } : {}),
      },
      include: {
        invoice: { include: { customer: { select: { fullName: true, customerRef: true } } } },
      },
    });

    const byCustomer: Record<string, { fullName: string; customerRef: string; totalCents: bigint }> = {};
    for (const p of payments) {
      const cid = p.invoice.customerId;
      if (!byCustomer[cid]) {
        byCustomer[cid] = {
          fullName: p.invoice.customer.fullName,
          customerRef: p.invoice.customer.customerRef,
          totalCents: 0n,
        };
      }
      byCustomer[cid].totalCents += p.amountCents;
    }

    return Object.values(byCustomer)
      .map((c) => ({ ...c, totalCents: safeCents(c.totalCents), totalDisplay: formatSgd(c.totalCents) }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }

  // ── 8. Upcoming Expiries ────────────────────────────────────────────────────
  async upcomingExpiriesReport(filter: ReportFilter) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isActive: true,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        OR: [
          { coeExpiry: { gte: filter.from, lte: filter.to } },
          { roadTaxExpiry: { gte: filter.from, lte: filter.to } },
          { insuranceExpiry: { gte: filter.from, lte: filter.to } },
          { inspectionDue: { gte: filter.from, lte: filter.to } },
        ],
      },
      select: {
        plateNumber: true,
        make: true,
        model: true,
        branchId: true,
        coeExpiry: true,
        roadTaxExpiry: true,
        insuranceExpiry: true,
        inspectionDue: true,
      },
    });

    return vehicles;
  }

  // ── 9. Branch Performance Report ───────────────────────────────────────────
  async branchPerformanceReport(filter: ReportFilter) {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, ...(filter.branchId ? { id: filter.branchId } : {}) },
      select: { id: true, name: true, code: true },
    });

    const results = await Promise.all(
      branches.map(async (branch) => {
        const [paymentsAgg, invoiceCount, vehicleCount, activeRentals] = await Promise.all([
          this.prisma.payment.aggregate({
            where: {
              receivedOn: { gte: filter.from, lte: filter.to },
              invoice: { branchId: branch.id },
            },
            _sum: { amountCents: true },
          }),
          this.prisma.invoice.count({
            where: { branchId: branch.id, issueDate: { gte: filter.from, lte: filter.to } },
          }),
          this.prisma.vehicle.count({ where: { branchId: branch.id, isActive: true } }),
          this.prisma.rentalAgreement.count({
            where: { branchId: branch.id, status: { in: ['ACTIVE', 'ENDING_SOON'] } },
          }),
        ]);

        const revenue = paymentsAgg._sum.amountCents ?? 0n;
        return {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.code,
          revenueCents: safeCents(revenue),
          revenueDisplay: formatSgd(revenue),
          invoicesIssued: invoiceCount,
          totalVehicles: vehicleCount,
          activeRentals,
        };
      }),
    );

    return results.sort((a, b) => b.revenueCents - a.revenueCents);
  }

  // ── Export helpers ──────────────────────────────────────────────────────────

  async exportToCsv(rows: Record<string, unknown>[]): Promise<Buffer> {
    if (rows.length === 0) return Buffer.from('No data\n');
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const v = String(row[h] ?? '');
            return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(','),
      ),
    ];
    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  async exportToExcel(rows: Record<string, unknown>[], sheetName: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    if (rows.length === 0) {
      ws.addRow(['No data']);
    } else {
      const headers = Object.keys(rows[0]);
      ws.addRow(headers).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      });
      for (const row of rows) {
        ws.addRow(headers.map((h) => row[h] ?? ''));
      }
      ws.columns.forEach((col) => {
        col.width = 20;
      });
    }

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async exportToPdf(
    rows: Record<string, unknown>[],
    title: string,
    columns: string[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('Karrkarr Pte Ltd', { align: 'center' });
      doc.fontSize(12).text(title, { align: 'center' });
      doc.moveDown();

      if (rows.length === 0) {
        doc.text('No data for selected period.');
      } else {
        const colWidth = (doc.page.width - 80) / columns.length;
        let x = 40;
        let y = doc.y;

        // Header row
        doc.fontSize(9).font('Helvetica-Bold');
        for (const col of columns) {
          doc.text(col, x, y, { width: colWidth, lineBreak: false });
          x += colWidth;
        }
        doc.moveDown();

        doc.font('Helvetica');
        for (const row of rows) {
          y = doc.y;
          x = 40;
          if (y > doc.page.height - 80) {
            doc.addPage();
            y = 40;
          }
          for (const col of columns) {
            doc.fontSize(8).text(String(row[col] ?? ''), x, y, { width: colWidth, lineBreak: false });
            x += colWidth;
          }
          doc.moveDown(0.8);
        }
      }

      doc.end();
    });
  }

  async fleetOverview(branchId?: string): Promise<Record<string, unknown>> {
    const branchFilter = branchId ? { branchId } : {};
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalVehicles,
      availableVehicles,
      currentlyRented,
      inMaintenance,
      returningSoon,
      paymentsDueToday,
      overduePayments,
      upcomingServicing,
      upcomingInspection,
      insuranceExpiring,
      roadTaxExpiring,
      coeExpiring,
      monthlyRevenue,
      outstandingReceivables,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { isActive: true, ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, status: 'AVAILABLE', ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, status: 'RENTED_OUT', ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, status: { in: ['MAINTENANCE', 'CLEANING', 'INSPECTION', 'ACCIDENT_REPAIR'] }, ...branchFilter } }),
      this.prisma.rentalAgreement.count({ where: { status: 'ENDING_SOON', ...branchFilter } }),
      this.prisma.invoice.count({ where: { status: 'DUE', dueDate: { lte: now }, ...branchFilter } }),
      this.prisma.invoice.count({ where: { status: 'OVERDUE', ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, nextServiceDate: { lte: thirtyDaysLater }, ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, inspectionDue: { lte: thirtyDaysLater }, ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, insuranceExpiry: { lte: thirtyDaysLater }, ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, roadTaxExpiry: { lte: thirtyDaysLater }, ...branchFilter } }),
      this.prisma.vehicle.count({ where: { isActive: true, coeExpiry: { lte: thirtyDaysLater }, ...branchFilter } }),
      this.prisma.payment.aggregate({ _sum: { amountCents: true }, where: { receivedOn: { gte: startOfMonth }, ...(branchFilter.branchId ? { invoice: { branchId: branchFilter.branchId } } : {}) } }),
      this.prisma.invoice.aggregate({ _sum: { outstandingCents: true }, where: { status: { notIn: ['PAID', 'CANCELLED', 'WRITTEN_OFF'] }, ...branchFilter } }),
    ]);

    const monthlyRevenueCents = monthlyRevenue._sum.amountCents ?? BigInt(0);
    const outstandingCents = outstandingReceivables._sum.outstandingCents ?? BigInt(0);
    const fleetUtilisationPct = totalVehicles > 0
      ? Math.round((currentlyRented / totalVehicles) * 100)
      : 0;

    return {
      totalVehicles,
      availableVehicles,
      currentlyRented,
      inMaintenance,
      returningSoon,
      paymentsDueToday,
      overduePayments,
      upcomingServicing,
      upcomingInspection,
      insuranceExpiring,
      roadTaxExpiring,
      coeExpiring,
      monthlyRevenue: { cents: Number(monthlyRevenueCents), display: formatSgd(monthlyRevenueCents) },
      outstandingReceivables: { cents: Number(outstandingCents), display: formatSgd(outstandingCents) },
      fleetUtilisationPct,
    };
  }
}
