import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './jobs.module';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(QUEUE_NAMES.PAYMENT_REMINDER) private paymentReminderQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INTEREST_ACCRUAL) private interestAccrualQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPIRY_REMINDER) private expiryReminderQueue: Queue,
    @InjectQueue(QUEUE_NAMES.RENTAL_STATUS) private rentalStatusQueue: Queue,
    @InjectQueue(QUEUE_NAMES.RISK_SCORING) private riskScoringQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INVOICE_GENERATION) private invoiceGenerationQueue: Queue,
  ) {}

  async triggerPaymentReminder(): Promise<void> {
    await this.paymentReminderQueue.add('manual-trigger', {}, { jobId: `manual-${Date.now()}` });
  }

  async triggerInterestAccrual(): Promise<void> {
    await this.interestAccrualQueue.add('manual-trigger', {}, { jobId: `manual-${Date.now()}` });
  }

  async triggerExpiryReminder(): Promise<void> {
    await this.expiryReminderQueue.add('manual-trigger', {}, { jobId: `manual-${Date.now()}` });
  }

  async triggerRentalStatus(): Promise<void> {
    await this.rentalStatusQueue.add('manual-trigger', {}, { jobId: `manual-${Date.now()}` });
  }

  async triggerRiskScoring(): Promise<void> {
    await this.riskScoringQueue.add('manual-trigger', {}, { jobId: `manual-${Date.now()}` });
  }

  async triggerInvoiceGeneration(): Promise<void> {
    await this.invoiceGenerationQueue.add('manual-trigger', {}, { jobId: `manual-${Date.now()}` });
  }

  async getQueueStats() {
    const queues = [
      { name: 'paymentReminder', queue: this.paymentReminderQueue },
      { name: 'interestAccrual', queue: this.interestAccrualQueue },
      { name: 'expiryReminder', queue: this.expiryReminderQueue },
      { name: 'rentalStatus', queue: this.rentalStatusQueue },
      { name: 'riskScoring', queue: this.riskScoringQueue },
      { name: 'invoiceGeneration', queue: this.invoiceGenerationQueue },
    ];

    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => ({
        name,
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
      })),
    );

    return stats;
  }
}
