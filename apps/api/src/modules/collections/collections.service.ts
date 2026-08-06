/**
 * CollectionsService — powers the Collections Dashboard.
 *
 * All ageing uses ageingBucket() from @karrkarr/shared which is consistent
 * with the interest accrual job's notion of "today".
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ageingBucket, formatSgd, daysOverdue } from '@karrkarr/shared';
import { NotificationChannel } from '@prisma/client';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async getSummary(branchId?: string) {
    const today = new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID', 'PENDING_VERIFICATION'] },
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        dueDate: true,
        outstandingCents: true,
        interestAccruedCents: true,
        interestWaivedCents: true,
      },
    });

    const buckets = {
      dueNext7Days: { count: 0, total: 0n },
      dueToday: { count: 0, total: 0n },
      overdue1to7: { count: 0, total: 0n },
      overdue8Plus: { count: 0, total: 0n },
    };

    let totalInterest = 0n;

    for (const inv of invoices) {
      const bucket = ageingBucket(inv.dueDate, today);
      const amount = inv.outstandingCents;
      totalInterest += inv.interestAccruedCents - inv.interestWaivedCents;

      switch (bucket) {
        case 'UPCOMING_7':
          buckets.dueNext7Days.count++;
          buckets.dueNext7Days.total += amount;
          break;
        case 'DUE_TODAY':
          buckets.dueToday.count++;
          buckets.dueToday.total += amount;
          break;
        case 'OVERDUE_1_7':
          buckets.overdue1to7.count++;
          buckets.overdue1to7.total += amount;
          break;
        case 'OVERDUE_8_PLUS':
          buckets.overdue8Plus.count++;
          buckets.overdue8Plus.total += amount;
          break;
      }
    }

    const totalReceivables = invoices.reduce((sum, inv) => sum + inv.outstandingCents, 0n);

    const toMoney = (cents: bigint) => ({
      cents: Number(cents),
      display: formatSgd(cents),
    });

    return {
      dueNext7Days: { count: buckets.dueNext7Days.count, total: toMoney(buckets.dueNext7Days.total) },
      dueToday: { count: buckets.dueToday.count, total: toMoney(buckets.dueToday.total) },
      overdue1to7: { count: buckets.overdue1to7.count, total: toMoney(buckets.overdue1to7.total) },
      overdue8Plus: { count: buckets.overdue8Plus.count, total: toMoney(buckets.overdue8Plus.total) },
      totalReceivables: toMoney(totalReceivables),
      interestAccrued: toMoney(totalInterest),
    };
  }

  async getRows(branchId?: string, page: number = 1, pageSize: number = 50) {
    const today = new Date();
    const skip = (page - 1) * pageSize;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
          ...(branchId ? { branchId } : {}),
        },
        skip,
        take: pageSize,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        include: {
          customer: { select: { id: true, fullName: true, customerRef: true, phone: true, riskScore: true } },
          rental: { select: { vehicle: { select: { plateNumber: true } } } },
          branch: { select: { name: true } },
          reminders: { orderBy: { sentAt: 'desc' }, take: 1, select: { sentAt: true } },
          _count: { select: { reminders: true } },
        },
      }),
      this.prisma.invoice.count({
        where: {
          status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const toMoney = (cents: bigint) => ({ cents: Number(cents), display: formatSgd(cents) });

    const rows = invoices.map((inv) => {
      const od = daysOverdue(inv.dueDate, today);
      const netInterest = inv.interestAccruedCents - inv.interestWaivedCents;
      const totalDue = inv.outstandingCents;

      return {
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        customerId: inv.customer.id,
        customerName: inv.customer.fullName,
        customerRef: inv.customer.customerRef,
        phone: inv.customer.phone,
        plateNumber: inv.rental.vehicle.plateNumber,
        branchName: inv.branch.name,
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        daysOverdue: od < 0 ? 0 : od,
        bucket: ageingBucket(inv.dueDate, today),
        principal: toMoney(inv.principalCents),
        interest: toMoney(netInterest),
        totalDue: toMoney(totalDue),
        riskScore: inv.customer.riskScore,
        lastReminderAt: inv.reminders[0]?.sentAt.toISOString() ?? null,
        remindersSent: inv._count.reminders,
      };
    });

    return { data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async getCustomerAuditTrail(customerId: string) {
    const [ledger, submissions, reminders, auditLogs] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { customerId },
        orderBy: { effectiveDate: 'desc' },
        take: 200,
      }),
      this.prisma.paymentSubmission.findMany({
        where: { customerId },
        orderBy: { submittedAt: 'desc' },
        include: { payment: true },
      }),
      this.prisma.reminderLog.findMany({
        where: { invoice: { customerId } },
        orderBy: { sentAt: 'desc' },
        take: 100,
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { actorCustomerId: customerId },
            {
              entityType: 'Invoice',
              action: { startsWith: 'payment.' },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return { ledger, submissions, reminders, auditLogs };
  }

  async triggerManualReminder(
    invoiceId: string,
    channel: NotificationChannel,
    adminId: string,
  ): Promise<void> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.notifications.notifyCustomer({
      customerId: invoice.customerId,
      eventType: 'payment.reminder',
      title: `Payment Reminder – ${invoice.invoiceNo}`,
      body: `This is a manual reminder from the collections team. Your invoice ${invoice.invoiceNo} for ${formatSgd(invoice.outstandingCents)} is outstanding.`,
      actionUrl: `/portal/invoices/${invoice.id}`,
      severity: 'warning',
      metadata: {
        invoiceNo: invoice.invoiceNo,
        amountDisplay: formatSgd(invoice.outstandingCents),
        manual: true,
        triggeredBy: adminId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorAdminId: adminId,
        actorType: 'ADMIN',
        action: 'collections.manual_reminder',
        entityType: 'Invoice',
        entityId: invoiceId,
        after: { channel },
      },
    });
  }
}
