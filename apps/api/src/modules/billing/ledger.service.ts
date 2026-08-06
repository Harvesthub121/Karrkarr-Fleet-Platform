/**
 * LedgerService — the ONLY component permitted to write LedgerEntry rows.
 *
 * Design contract:
 *   1. Append-only: rows are never updated or deleted. A mistake is a new row.
 *   2. Every write recomputes and caches Invoice.outstandingCents and
 *      RentalAgreement.depositBalanceCents inside the SAME Prisma transaction.
 *   3. idempotencyKey is enforced at the DB level (unique index). A duplicate
 *      call returns the existing row — the job processor can retry freely.
 *   4. Every write also appends to AuditLog so "who wrote this interest entry?"
 *      is always answerable.
 */

import { Injectable, Logger } from '@nestjs/common';
import { LedgerEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface WriteLedgerEntryInput {
  customerId: string;
  rentalAgreementId?: string;
  invoiceId?: string;
  type: LedgerEntryType;
  /** Positive = customer owes more. Negative = customer owes less. */
  amountCents: bigint;
  description: string;
  /** Business date the entry applies to. May be backdated for accruals. */
  effectiveDate: Date;
  idempotencyKey?: string;
  /** NULL = system/automation. */
  createdBy?: string;
  /** Prisma transaction client. Pass when composing inside an outer tx. */
  tx?: Prisma.TransactionClient;
}

export interface LedgerWriteResult {
  entry: { id: string; idempotencyKey: string | null };
  /** true when the idempotencyKey already existed — caller must treat as no-op. */
  wasIdempotentSkip: boolean;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async write(input: WriteLedgerEntryInput): Promise<LedgerWriteResult> {
    const executor = input.tx ?? this.prisma;

    // Short-circuit on duplicate idempotency key. The unique index would throw
    // a P2002, but checking first gives us a clean boolean for callers.
    if (input.idempotencyKey) {
      const existing = await (executor as PrismaService).ledgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, idempotencyKey: true },
      });
      if (existing) {
        return { entry: existing, wasIdempotentSkip: true };
      }
    }

    const runInTx = async (tx: Prisma.TransactionClient): Promise<LedgerWriteResult> => {
      // --- 1. Running balance for this customer ---
      const lastEntry = await tx.ledgerEntry.findFirst({
        where: { customerId: input.customerId },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfterCents: true },
      });
      const prevBalance: bigint = lastEntry?.balanceAfterCents ?? 0n;
      const newBalance = prevBalance + input.amountCents;

      // --- 2. Write the ledger entry ---
      const entry = await tx.ledgerEntry.create({
        data: {
          customerId: input.customerId,
          rentalAgreementId: input.rentalAgreementId,
          invoiceId: input.invoiceId,
          type: input.type,
          amountCents: input.amountCents,
          balanceAfterCents: newBalance,
          description: input.description,
          effectiveDate: input.effectiveDate,
          idempotencyKey: input.idempotencyKey,
          createdBy: input.createdBy,
        },
        select: { id: true, idempotencyKey: true },
      });

      // --- 3. Recompute and cache Invoice.outstandingCents ---
      if (input.invoiceId) {
        await this.recomputeInvoiceCache(tx, input.invoiceId);
      }

      // --- 4. Recompute and cache RentalAgreement.depositBalanceCents ---
      if (input.rentalAgreementId) {
        await this.recomputeDepositCache(tx, input.rentalAgreementId);
      }

      // --- 5. Audit log ---
      await tx.auditLog.create({
        data: {
          actorAdminId: input.createdBy ?? null,
          actorType: input.createdBy ? 'ADMIN' : 'SYSTEM',
          action: `ledger.write.${input.type.toLowerCase()}`,
          entityType: 'LedgerEntry',
          entityId: entry.id,
          after: {
            type: input.type,
            amountCents: input.amountCents.toString(),
            invoiceId: input.invoiceId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });

      return { entry, wasIdempotentSkip: false };
    };

    // If caller passed a tx, compose inside it; otherwise open our own.
    if (input.tx) {
      return runInTx(input.tx);
    }
    return this.prisma.$transaction(runInTx);
  }

  /**
   * Recompute outstandingCents from first principles by summing the ledger.
   * Called inside the same transaction as every write so the cache is always
   * consistent. On crash-recovery, `ledger:reconcile` calls this directly.
   */
  async recomputeInvoiceCache(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ): Promise<void> {
    const agg = await tx.ledgerEntry.aggregate({
      where: { invoiceId },
      _sum: { amountCents: true },
    });
    const sumCents: bigint = agg._sum.amountCents ?? 0n;

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { principalCents: true, interestAccruedCents: true, interestWaivedCents: true },
    });

    // outstanding = principal + interestAccrued - interestWaived - payments
    // The ledger captures charges as +, payments as -.
    // sumCents already reflects all ledger movements for this invoice.
    // We re-derive from scratch: sum all positive types - sum all negative types.
    const posAgg = await tx.ledgerEntry.aggregate({
      where: {
        invoiceId,
        type: { in: ['RENTAL_CHARGE', 'LATE_INTEREST', 'ACCIDENT_EXCESS', 'MISC_CHARGE'] },
      },
      _sum: { amountCents: true },
    });
    const negAgg = await tx.ledgerEntry.aggregate({
      where: {
        invoiceId,
        type: { in: ['PAYMENT_RECEIVED', 'CREDIT_NOTE', 'WRITE_OFF', 'INTEREST_WAIVER', 'DEPOSIT_APPLIED'] },
      },
      _sum: { amountCents: true },
    });

    const totalCharged: bigint = posAgg._sum.amountCents ?? 0n;
    const totalCredited: bigint = negAgg._sum.amountCents ?? 0n;
    // negAgg amounts are stored as negative bigints in the ledger
    const outstanding = totalCharged + totalCredited; // totalCredited is already negative
    const clamped = outstanding < 0n ? 0n : outstanding;

    // Also maintain the interest aggregate caches on Invoice for the cap logic
    const interestAgg = await tx.ledgerEntry.aggregate({
      where: { invoiceId, type: 'LATE_INTEREST' },
      _sum: { amountCents: true },
    });
    const waiverAgg = await tx.ledgerEntry.aggregate({
      where: { invoiceId, type: 'INTEREST_WAIVER' },
      _sum: { amountCents: true },
    });
    const paymentAgg = await tx.ledgerEntry.aggregate({
      where: { invoiceId, type: 'PAYMENT_RECEIVED' },
      _sum: { amountCents: true },
    });

    const interestAccrued: bigint = interestAgg._sum.amountCents ?? 0n;
    // waiverAgg amounts are negative; negate to get positive waived amount
    const interestWaived: bigint = -(waiverAgg._sum.amountCents ?? 0n);
    const paid: bigint = -(paymentAgg._sum.amountCents ?? 0n);

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        outstandingCents: clamped,
        interestAccruedCents: interestAccrued,
        interestWaivedCents: interestWaived,
        paidCents: paid,
      },
    });
  }

  private async recomputeDepositCache(
    tx: Prisma.TransactionClient,
    rentalAgreementId: string,
  ): Promise<void> {
    const depositAgg = await tx.ledgerEntry.aggregate({
      where: { rentalAgreementId, type: 'DEPOSIT_RECEIVED' },
      _sum: { amountCents: true },
    });
    const appliedAgg = await tx.ledgerEntry.aggregate({
      where: { rentalAgreementId, type: 'DEPOSIT_APPLIED' },
      _sum: { amountCents: true },
    });

    // DEPOSIT_RECEIVED is stored as negative (reduces customer debt)
    // DEPOSIT_APPLIED is stored as negative (reduces customer debt)
    const received: bigint = -(depositAgg._sum.amountCents ?? 0n);
    const applied: bigint = -(appliedAgg._sum.amountCents ?? 0n);
    const balance = received - applied;

    await tx.rentalAgreement.update({
      where: { id: rentalAgreementId },
      data: { depositBalanceCents: balance < 0n ? 0n : balance },
    });
  }
}
