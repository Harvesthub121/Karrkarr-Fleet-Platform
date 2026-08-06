/**
 * InterestAccrualProcessor — nightly sweep that back-fills all missing
 * interest days for OVERDUE and PARTIALLY_PAID invoices.
 *
 * Idempotency + downtime safety:
 *   - calculateAccrual() starts from lastInterestAccrualDate + 1 day.
 *   - Each day gets idempotencyKey = `interest:{invoiceId}:{date}` (unique DB index).
 *   - A re-run or post-downtime run is therefore safe: already-written days
 *     are no-ops, unwritten days are filled in.
 *   - We process invoices one at a time (not batched) so a crash mid-sweep
 *     leaves already-processed invoices committed and the job just resumes.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { InterestService } from '../../billing/interest.service';
import { QUEUE_NAMES } from '../jobs.module';

@Processor(QUEUE_NAMES.INTEREST_ACCRUAL)
export class InterestAccrualProcessor extends WorkerHost {
  private readonly logger = new Logger(InterestAccrualProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interest: InterestService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log('Interest accrual sweep started');

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['OVERDUE', 'PARTIALLY_PAID'] },
        outstandingCents: { gt: 0n },
      },
      select: {
        id: true,
        invoiceNo: true,
        dueDate: true,
        appliedGracePeriodDays: true,
      },
    });

    this.logger.log(`Processing ${invoices.length} invoices for interest accrual`);
    let totalDays = 0;
    let totalCents = 0n;

    for (const invoice of invoices) {
      try {
        const result = await this.interest.accrueForInvoice(invoice.id);
        totalDays += result.daysWritten;
        totalCents += result.totalCents;
      } catch (err: any) {
        // Log per-invoice errors but continue — one bad invoice must not block the rest
        this.logger.error(`Accrual failed for invoice ${invoice.id}: ${err.message}`);
      }
    }

    this.logger.log(
      `Accrual sweep complete: ${totalDays} new entries, ${totalCents} cents across ${invoices.length} invoices`,
    );
  }
}
