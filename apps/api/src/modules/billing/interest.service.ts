/**
 * InterestService — wraps calculateAccrual and writes LATE_INTEREST ledger
 * entries. The core accrual logic lives in @karrkarr/shared/interest.ts (pure fn).
 *
 * Idempotency: idempotencyKey = `interest:{invoiceId}:{YYYY-MM-DD}` (UTC).
 * The DB unique index on LedgerEntry.idempotencyKey turns a duplicate accrual
 * attempt into a no-op (LedgerService.write returns wasIdempotentSkip=true).
 *
 * Downtime back-fill: `lastInterestAccrualDate` on Invoice records the last
 * successfully written accrual. calculateAccrual sets `start = lastAccrualDate
 * + 1 day`, so a job that was down for 5 days will back-fill all 5 days in one
 * pass. Each day gets its own idempotency key so a partial back-fill is also safe.
 *
 * Principal snapshot: we pass the current outstandingCents minus accrued
 * interest as the principal. This means a partial payment made yesterday
 * reduces today's charge — correct for simple interest on principal.
 */

import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PolicyService } from '../policy/policy.service';
import { LedgerService } from './ledger.service';
import {
  calculateAccrual,
  toUtcMidnight,
  isoDate,
  POLICY_KEYS,
} from '@karrkarr/shared';

@Injectable()
export class InterestService {
  private readonly logger = new Logger(InterestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Accrue interest for a single invoice up to `through` (defaults to today SGT).
   * Returns the number of new ledger entries written (0 on a clean re-run).
   */
  async accrueForInvoice(
    invoiceId: string,
    through?: Date,
  ): Promise<{ daysWritten: number; totalCents: bigint }> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: {
        id: true,
        customerId: true,
        rentalAgreementId: true,
        dueDate: true,
        status: true,
        principalCents: true,
        outstandingCents: true,
        interestAccruedCents: true,
        interestWaivedCents: true,
        paidCents: true,
        lastInterestAccrualDate: true,
        appliedInterestRateBps: true,
        appliedGracePeriodDays: true,
        branchId: true,
      },
    });

    const accrualEligibleStatuses: InvoiceStatus[] = ['OVERDUE', 'PARTIALLY_PAID', 'DUE'];
    if (!accrualEligibleStatuses.includes(invoice.status)) {
      return { daysWritten: 0, totalCents: 0n };
    }

    // Outstanding PRINCIPAL: total outstanding minus already-accrued interest not yet paid.
    // We want simple interest on the principal only, never on the interest.
    const outstandingPrincipalCents = invoice.principalCents - invoice.paidCents;
    const clampedPrincipal = outstandingPrincipalCents < 0n ? 0n : outstandingPrincipalCents;

    const capBps = await this.policy.get(POLICY_KEYS.INTEREST_CAP_BPS, {
      branchId: invoice.branchId,
    });

    // Use rate frozen at invoice issue time — never re-read policy for old invoices
    const policy = {
      dailyRateBps: invoice.appliedInterestRateBps,
      gracePeriodDays: invoice.appliedGracePeriodDays,
      capBps: Number(capBps) > 0 ? Number(capBps) : undefined,
    };

    // Default to SGT "today" at UTC midnight
    const throughDate = through
      ? toUtcMidnight(through)
      : toUtcMidnight(this.sgtNow());

    const result = calculateAccrual({
      invoiceId,
      dueDate: invoice.dueDate,
      outstandingPrincipalCents: clampedPrincipal,
      alreadyAccruedCents: invoice.interestAccruedCents,
      lastAccrualDate: invoice.lastInterestAccrualDate,
      through: throughDate,
      policy,
    });

    if (result.days.length === 0) {
      return { daysWritten: 0, totalCents: 0n };
    }

    let daysWritten = 0;
    let totalCents = 0n;

    // Write each day as a separate ledger entry for granular idempotency.
    // If we crash halfway through, the next run skips already-written days
    // via the idempotency key and writes only the remaining ones.
    for (const day of result.days) {
      const { wasIdempotentSkip } = await this.ledger.write({
        customerId: invoice.customerId,
        rentalAgreementId: invoice.rentalAgreementId ?? undefined,
        invoiceId: invoice.id,
        type: LedgerEntryType.LATE_INTEREST,
        amountCents: day.chargeCents,
        description: `Late interest for ${isoDate(day.date)} on ${invoice.id}`,
        effectiveDate: day.date,
        idempotencyKey: day.idempotencyKey,
      });

      if (!wasIdempotentSkip) {
        daysWritten++;
        totalCents += day.chargeCents;
        // Advance the accrual cursor on the invoice after each successful write.
        // Using a separate update (not inside the ledger tx) is safe because the
        // idempotency key guards against any re-run.
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { lastInterestAccrualDate: day.date },
        });
      }
    }

    this.logger.log(
      `Accrued ${daysWritten} days / ${totalCents} cents interest for invoice ${invoiceId}`,
    );
    return { daysWritten, totalCents };
  }

  /**
   * Waive interest on an invoice. Requires interest.waive permission (checked
   * by the controller). Writes an INTEREST_WAIVER ledger entry.
   */
  async waiveInterest(
    invoiceId: string,
    waiveAmountCents: bigint,
    reason: string,
    waivedBy: string,
  ): Promise<void> {
    if (!reason?.trim()) {
      throw new BadRequestException('Reason is required for interest waiver');
    }

    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: {
        id: true,
        customerId: true,
        rentalAgreementId: true,
        invoiceNo: true,
        interestAccruedCents: true,
        interestWaivedCents: true,
        status: true,
      },
    });

    const maxWaivable = invoice.interestAccruedCents - invoice.interestWaivedCents;
    if (waiveAmountCents > maxWaivable) {
      throw new BadRequestException(
        `Cannot waive ${waiveAmountCents} cents; only ${maxWaivable} cents of un-waived interest exists`,
      );
    }

    await this.ledger.write({
      customerId: invoice.customerId,
      rentalAgreementId: invoice.rentalAgreementId ?? undefined,
      invoiceId: invoice.id,
      type: LedgerEntryType.INTEREST_WAIVER,
      amountCents: -waiveAmountCents, // negative = reduces what customer owes
      description: `Interest waiver on ${invoice.invoiceNo}: ${reason}`,
      effectiveDate: new Date(),
      idempotencyKey: `waiver:${invoice.id}:${Date.now()}`,
      createdBy: waivedBy,
    });

    await this.prisma.auditLog.create({
      data: {
        actorAdminId: waivedBy,
        actorType: 'ADMIN',
        action: 'interest.waive',
        entityType: 'Invoice',
        entityId: invoiceId,
        after: { amountCents: waiveAmountCents.toString(), reason },
      },
    });
  }

  /** Current time in Singapore timezone, expressed as a JS Date (still UTC internally). */
  private sgtNow(): Date {
    const now = new Date();
    // SGT = UTC+8. We normalise to UTC midnight in calculateAccrual anyway,
    // but we use the SGT calendar day to decide "what day is 'today'".
    const sgtOffset = 8 * 60;
    const sgtMs = now.getTime() + sgtOffset * 60 * 1000;
    return new Date(sgtMs);
  }
}
