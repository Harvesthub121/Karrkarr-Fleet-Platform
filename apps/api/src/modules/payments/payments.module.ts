import { Module } from '@nestjs/common';
import { PayNowService } from './paynow.service';
import { PaymentSubmissionService } from './payment-submission.service';
import { PaymentsController } from './payments.controller';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PolicyModule } from '../policy/policy.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [BillingModule, NotificationsModule, PolicyModule, DocumentsModule],
  controllers: [PaymentsController],
  providers: [PayNowService, PaymentSubmissionService],
  exports: [PayNowService, PaymentSubmissionService],
})
export class PaymentsModule {}
