import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentReminderProcessor } from './processors/payment-reminder.processor';
import { InterestAccrualProcessor } from './processors/interest-accrual.processor';
import { ExpiryReminderProcessor } from './processors/expiry-reminder.processor';
import { RentalStatusProcessor } from './processors/rental-status.processor';
import { RiskScoringProcessor } from './processors/risk-scoring.processor';
import { InvoiceGenerationProcessor } from './processors/invoice-generation.processor';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

export const QUEUE_NAMES = {
  PAYMENT_REMINDER: 'payment-reminder',
  INTEREST_ACCRUAL: 'interest-accrual',
  EXPIRY_REMINDER: 'expiry-reminder',
  RENTAL_STATUS: 'rental-status',
  RISK_SCORING: 'risk-scoring',
  INVOICE_GENERATION: 'invoice-generation',
} as const;

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.PAYMENT_REMINDER },
      { name: QUEUE_NAMES.INTEREST_ACCRUAL },
      { name: QUEUE_NAMES.EXPIRY_REMINDER },
      { name: QUEUE_NAMES.RENTAL_STATUS },
      { name: QUEUE_NAMES.RISK_SCORING },
      { name: QUEUE_NAMES.INVOICE_GENERATION },
    ),
    BillingModule,
    NotificationsModule,
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    PaymentReminderProcessor,
    InterestAccrualProcessor,
    ExpiryReminderProcessor,
    RentalStatusProcessor,
    RiskScoringProcessor,
    InvoiceGenerationProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
