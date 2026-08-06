/**
 * RentalStatusProcessor — nightly job that:
 *   1. Flips ACTIVE rentals to ENDING_SOON within the policy window.
 *   2. Flips UPCOMING invoices to DUE when issueDate is reached.
 *   3. Flips DUE invoices to OVERDUE when dueDate is past.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PolicyService } from '../../policy/policy.service';
import { NotificationService } from '../../notifications/notification.service';
import { POLICY_KEYS } from '@vida/shared';
import { QUEUE_NAMES } from '../jobs.module';

function sgtToday(): Date {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()));
}

@Processor(QUEUE_NAMES.RENTAL_STATUS)
export class RentalStatusProcessor extends WorkerHost {
  private readonly logger = new Logger(RentalStatusProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly notifications: NotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const today = sgtToday();

    // 1. ACTIVE -> ENDING_SOON
    const endingSoonDays = Number(
      await this.policy.get(POLICY_KEYS.RENTAL_ENDING_SOON_DAYS),
    );
    const endingSoonThreshold = new Date(today.getTime() + endingSoonDays * 86_400_000);

    const newlyEndingSoon = await this.prisma.rentalAgreement.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: endingSoonThreshold, gte: today },
      },
      data: { status: 'ENDING_SOON' },
    });
    if (newlyEndingSoon.count > 0) {
      this.logger.log(`${newlyEndingSoon.count} rentals flipped to ENDING_SOON`);
    }

    // Notify for newly ending-soon rentals
    const endingSoonRentals = await this.prisma.rentalAgreement.findMany({
      where: { status: 'ENDING_SOON', endDate: { gte: today } },
      select: {
        id: true, agreementNo: true, branchId: true, endDate: true,
        customer: { select: { fullName: true } },
        vehicle: { select: { plateNumber: true } },
      },
    });
    for (const rental of endingSoonRentals) {
      await this.notifications.fanOutToAdmins({
        branchId: rental.branchId,
        eventType: 'rental.ending_soon',
        title: `Rental Ending Soon – ${rental.agreementNo}`,
        body: `Rental ${rental.agreementNo} for ${rental.customer.fullName} ends on ${new Date(rental.endDate).toLocaleDateString('en-SG')}.`,
        actionUrl: `/admin/rentals/${rental.id}`,
        severity: 'info',
        metadata: {
          agreementNo: rental.agreementNo,
          customerName: rental.customer.fullName,
          plateNumber: rental.vehicle.plateNumber,
          endDate: rental.endDate.toISOString().slice(0, 10),
        },
      }).catch(() => {/* ignore notification failures */});
    }

    // 2. UPCOMING -> DUE (invoice issue date reached)
    const newlyDue = await this.prisma.invoice.updateMany({
      where: {
        status: 'UPCOMING',
        issueDate: { lte: today },
      },
      data: { status: 'DUE' },
    });
    if (newlyDue.count > 0) {
      this.logger.log(`${newlyDue.count} invoices flipped to DUE`);
    }

    // 3. DUE/PARTIALLY_PAID -> OVERDUE (due date passed)
    const newlyOverdue = await this.prisma.invoice.updateMany({
      where: {
        status: { in: ['DUE', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    });
    if (newlyOverdue.count > 0) {
      this.logger.log(`${newlyOverdue.count} invoices flipped to OVERDUE`);
    }
  }
}
