/**
 * RiskScoringProcessor — nightly recompute of customer risk scores 0-100.
 *
 * Formula (weights from policy):
 *   score = clamp(
 *     daysOverdueWeight * avgDaysOverdue
 *     + lateCountWeight * latePaymentCount
 *     + rejectedCountWeight * rejectedSubmissionCount,
 *     0, 100
 *   )
 *
 * Looks back N months (from policy collections.riskLookbackMonths).
 * Fires a 'risk.customer_high' admin notification if score > 70.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PolicyService } from '../../policy/policy.service';
import { NotificationService } from '../../notifications/notification.service';
import { POLICY_KEYS, daysOverdue } from '@karrkarr/shared';
import { QUEUE_NAMES } from '../jobs.constants';

const HIGH_RISK_THRESHOLD = 70;

@Processor(QUEUE_NAMES.RISK_SCORING)
export class RiskScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(RiskScoringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly notifications: NotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log('Risk scoring sweep started');

    const daysOverdueWeight = Number(await this.policy.get(POLICY_KEYS.RISK_WEIGHT_DAYS_OVERDUE));
    const lateCountWeight = Number(await this.policy.get(POLICY_KEYS.RISK_WEIGHT_LATE_COUNT));
    const rejectedCountWeight = Number(await this.policy.get(POLICY_KEYS.RISK_WEIGHT_REJECTED_COUNT));
    const lookbackMonths = Number(await this.policy.get(POLICY_KEYS.RISK_LOOKBACK_MONTHS));

    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths);

    const customers = await this.prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, customerRef: true, branchId: true, riskScore: true },
    });

    for (const customer of customers) {
      try {
        const newScore = await this.computeScore(
          customer.id,
          lookbackDate,
          daysOverdueWeight,
          lateCountWeight,
          rejectedCountWeight,
        );

        const wasHighRisk = customer.riskScore < HIGH_RISK_THRESHOLD;
        const isNowHighRisk = newScore >= HIGH_RISK_THRESHOLD;

        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { riskScore: newScore, riskScoreUpdatedAt: new Date() },
        });

        // Alert admins only when a customer crosses the threshold (edge-triggered)
        if (!wasHighRisk && isNowHighRisk) {
          await this.notifications.fanOutToAdmins({
            branchId: customer.branchId,
            eventType: 'risk.customer_high',
            title: `High-Risk Customer Alert – ${customer.customerRef}`,
            body: `Customer ${customer.fullName} risk score has reached ${newScore}/100.`,
            actionUrl: `/admin/collections?customerId=${customer.id}`,
            severity: 'critical',
            metadata: {
              customerId: customer.id,
              customerName: customer.fullName,
              customerRef: customer.customerRef,
              riskScore: newScore,
            },
          }).catch(() => {});
        }
      } catch (err: any) {
        this.logger.error(`Risk score failed for customer ${customer.id}: ${err.message}`);
      }
    }

    this.logger.log(`Risk scoring complete for ${customers.length} customers`);
  }

  private async computeScore(
    customerId: string,
    lookbackDate: Date,
    daysOverdueWeight: number,
    lateCountWeight: number,
    rejectedCountWeight: number,
  ): Promise<number> {
    const now = new Date();

    // Count invoices that were ever overdue within lookback window
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        dueDate: { gte: lookbackDate },
        status: { in: ['OVERDUE', 'PARTIALLY_PAID', 'PAID', 'WRITTEN_OFF'] },
      },
      select: { dueDate: true, paidAt: true, status: true },
    });

    let totalLateCount = 0;
    let totalDaysOverdue = 0;

    for (const inv of overdueInvoices) {
      const refDate = inv.paidAt ?? now;
      const od = daysOverdue(inv.dueDate, refDate);
      if (od > 0) {
        totalLateCount++;
        totalDaysOverdue += od;
      }
    }

    const avgDaysOverdue = totalLateCount > 0 ? totalDaysOverdue / totalLateCount : 0;

    // Count rejected payment submissions
    const rejectedCount = await this.prisma.paymentSubmission.count({
      where: {
        customerId,
        status: 'REJECTED',
        submittedAt: { gte: lookbackDate },
      },
    });

    const rawScore =
      daysOverdueWeight * avgDaysOverdue +
      lateCountWeight * totalLateCount +
      rejectedCountWeight * rejectedCount;

    return Math.min(100, Math.max(0, Math.round(rawScore)));
  }
}
