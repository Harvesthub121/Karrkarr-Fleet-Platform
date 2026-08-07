import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { InvoiceService } from './invoice.service';
import { InterestService } from './interest.service';
import { BillingController } from './billing.controller';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [PolicyModule],
  controllers: [BillingController],
  providers: [LedgerService, InvoiceService, InterestService],
  exports: [LedgerService, InvoiceService, InterestService],
})
export class BillingModule {}