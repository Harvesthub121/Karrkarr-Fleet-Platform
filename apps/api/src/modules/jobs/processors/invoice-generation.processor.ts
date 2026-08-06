/**
 * InvoiceGenerationProcessor — daily job that issues invoices invoiceLeadDays
 * ahead of their period start. Lead time allows customers to see the upcoming
 * charge and arrange funds before it's due.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PolicyService } from '../../policy/policy.service';
import { InvoiceService } from '../../billing/invoice.service';
import { POLICY_KEYS } from '@karrkarr/shared';
import { QUEUE_NAMES } from '../jobs.module';

function sgtToday(): Date {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()));
}

@Processor(QUEUE_NAMES.INVOICE_GENERATION)
export class InvoiceGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly invoiceService: InvoiceService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log('Invoice generation sweep started');
    const today = sgtToday();

    const leadDays = Number(await this.policy.get(POLICY_KEYS.INVOICE_LEAD_DAYS));
    const generateThrough = new Date(today.getTime() + leadDays * 86_400_000);

    // Active rentals that haven't ended yet
    const rentals = await this.prisma.rentalAgreement.findMany({
      where: {
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
        endDate: { gte: today },
      },
      select: {
        id: true,
        billingFrequency: true,
        billingAnchorDay: true,
        endDate: true,
        branchId: true,
      },
    });

    let generated = 0;

    for (const rental of rentals) {
      try {
        // Find the latest invoice for this rental to know where we left off
        const lastInvoice = await this.prisma.invoice.findFirst({
          where: {
            rentalAgreementId: rental.id,
            status: { not: 'CANCELLED' },
          },
          orderBy: { periodEnd: 'desc' },
          select: { periodEnd: true },
        });

        const afterDate = lastInvoice ? lastInvoice.periodEnd : new Date(today.getTime() - 86_400_000);

        const next = this.invoiceService.computeNextPeriod(
          rental.billingFrequency,
          rental.billingAnchorDay,
          afterDate,
        );

        // Generate if the period starts within the lead window and before rental end
        if (next.periodStart <= generateThrough && next.periodStart <= new Date(rental.endDate)) {
          await this.invoiceService.generateInvoice({
            rentalAgreementId: rental.id,
            periodStart: next.periodStart,
            periodEnd: next.periodEnd,
            issueDate: today,
          });
          generated++;
        }
      } catch (err: any) {
        this.logger.error(`Invoice gen failed for rental ${rental.id}: ${err.message}`);
      }
    }

    this.logger.log(`Generated ${generated} invoices for ${rentals.length} active rentals`);
  }
}
