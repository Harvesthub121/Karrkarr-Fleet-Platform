/**
 * PaymentReminderProcessor — daily sweep at 09:00 SGT.
 *
 * Sends reminders for:
 *   - T-N days before due (from policy reminders.daysBefore, e.g. [3, 1])
 *   - T-0 (due date)
 *   - Every overdueIntervalDays while overdue, up to overdueMaxDays
 *
 * Idempotency: ReminderLog has a unique constraint on (invoiceId, reminderCode, channel).
 * The upsert-or-skip pattern means a restart can't double-send to the same customer.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PolicyService } from '../../policy/policy.service';
import { NotificationService } from '../../notifications/notification.service';
import { POLICY_KEYS, parseDayLadder, formatSgd } from '@karrkarr/shared';
import { QUEUE_NAMES } from '../jobs.module';

function sgtToday(): Date {
  const now = new Date();
  const sgtOffset = 8 * 60 * 60 * 1000;
  const sgt = new Date(now.getTime() + sgtOffset);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()));
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

@Processor(QUEUE_NAMES.PAYMENT_REMINDER)
export class PaymentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly notifications: NotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log('Payment reminder sweep started');

    const today = sgtToday();

    // Fetch all non-terminal invoices that might need a reminder
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
      include: {
        customer: { select: { id: true, fullName: true, email: true, branchId: true } },
      },
    });

    for (const invoice of invoices) {
      try {
        await this.processInvoiceReminder(invoice, today);
      } catch (err: any) {
        this.logger.error(`Reminder failed for invoice ${invoice.id}: ${err.message}`);
      }
    }

    this.logger.log(`Reminder sweep complete for ${invoices.length} invoices`);
  }

  private async processInvoiceReminder(invoice: any, today: Date): Promise<void> {
    const dueDate = new Date(invoice.dueDate);
    const daysUntilDue = daysDiff(today, dueDate); // negative = overdue
    const daysOverdue = -daysUntilDue;

    const daysBefore = parseDayLadder(
      String(await this.policy.get(POLICY_KEYS.REMINDER_DAYS_BEFORE, { branchId: invoice.branchId })),
    );
    const overdueInterval = Number(
      await this.policy.get(POLICY_KEYS.REMINDER_OVERDUE_INTERVAL_DAYS, { branchId: invoice.branchId }),
    );
    const overdueMax = Number(
      await this.policy.get(POLICY_KEYS.REMINDER_OVERDUE_MAX_DAYS, { branchId: invoice.branchId }),
    );
    const sendOnDueDate = String(
      await this.policy.get(POLICY_KEYS.REMINDER_ON_DUE_DATE, { branchId: invoice.branchId }),
    ) === 'true';

    let reminderCode: string | null = null;

    if (daysUntilDue > 0 && daysBefore.includes(daysUntilDue)) {
      reminderCode = `T-${daysUntilDue}`;
    } else if (daysUntilDue === 0 && sendOnDueDate) {
      reminderCode = 'T-0';
    } else if (daysOverdue > 0 && daysOverdue <= overdueMax) {
      // Only send every overdueInterval days
      if (daysOverdue % overdueInterval === 0) {
        reminderCode = `OVERDUE-${daysOverdue}`;
      }
    }

    if (!reminderCode) return;

    // Check idempotency — ReminderLog unique constraint on (invoiceId, reminderCode, channel)
    const alreadySent = await this.prisma.reminderLog.findUnique({
      where: {
        invoiceId_reminderCode_channel: {
          invoiceId: invoice.id,
          reminderCode,
          channel: 'EMAIL',
        },
      },
    });
    if (alreadySent) return;

    const amountDisplay = formatSgd(invoice.outstandingCents);
    const dueDateStr = dueDate.toLocaleDateString('en-SG');

    const title =
      daysOverdue > 0
        ? `Payment Overdue – ${invoice.invoiceNo}`
        : daysUntilDue === 0
          ? `Payment Due Today – ${invoice.invoiceNo}`
          : `Payment Reminder – ${invoice.invoiceNo} Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;

    const body =
      daysOverdue > 0
        ? `Your invoice ${invoice.invoiceNo} for ${amountDisplay} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Late interest is accruing daily. Please pay immediately.`
        : `Your invoice ${invoice.invoiceNo} for ${amountDisplay} is due on ${dueDateStr}.`;

    let success = true;
    let errorMessage: string | undefined;

    try {
      await this.notifications.notifyCustomer({
        customerId: invoice.customer.id,
        eventType: 'payment.reminder',
        title,
        body,
        actionUrl: `/portal/invoices/${invoice.id}`,
        severity: daysOverdue > 0 ? 'critical' : 'warning',
        metadata: {
          invoiceNo: invoice.invoiceNo,
          amountDisplay,
          dueDate: dueDateStr,
        },
      });
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
    }

    // Log the attempt (success or failure) to prevent double-send
    await this.prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        reminderCode,
        channel: 'EMAIL',
        success,
        errorMessage,
        quotedAmountCents: invoice.outstandingCents,
      },
    });
  }
}
