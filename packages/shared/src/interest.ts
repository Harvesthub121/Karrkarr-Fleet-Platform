/**
 * LATE PAYMENT INTEREST ENGINE
 * ============================
 *
 * This is the highest-risk logic in the platform: it decides how much money
 * Karrkarr asks a customer for. It is a pure function so it can be tested
 * exhaustively without a database.
 *
 * THE RULE (signed off by the client, 6 Aug 2026):
 *
 *   Simple daily interest on the OUTSTANDING PRINCIPAL. No compounding.
 *
 *   dailyCharge = round_half_up(outstandingPrincipal * dailyRateBps / 10_000)
 *
 * Consequences of "simple, on principal" that the implementation must honour:
 *
 *   1. Accrued interest NEVER earns interest. The base is principal only.
 *   2. A partial payment reduces the principal, so tomorrow's charge is
 *      smaller. Yesterday's charges are NOT recalculated.
 *   3. Interest starts the day AFTER the grace period expires.
 *      dueDate = 10 Aug, grace = 3 days -> first accrual date is 14 Aug.
 *   4. Each day is a discrete, idempotent ledger entry keyed by
 *      (invoiceId, date). Re-running the job for a date is a no-op, which is
 *      what makes the nightly sweep safe to retry after a crash.
 *   5. The rate is frozen onto the invoice at issue time. Changing the policy
 *      tomorrow does not retroactively rewrite invoices issued today.
 */

import { applyBps, nonNegative, ZERO, type Bps, type Cents } from './money';

export interface InterestPolicy {
  /** Basis points PER DAY. 100 = 1%/day. */
  dailyRateBps: Bps;
  /** Days after dueDate before interest begins. */
  gracePeriodDays: number;
  /**
   * Maximum total interest as bps of principal. 0 = uncapped.
   * A cap is good practice — uncapped 1%/day passes 100% of principal in
   * ~100 days and becomes both commercially pointless and legally awkward.
   */
  capBps?: Bps;
}

export interface AccrualDay {
  /** UTC-midnight date this charge applies to. */
  date: Date;
  /** Principal the charge was computed on. */
  principalCents: Cents;
  /** Interest charged for this single day. */
  chargeCents: Cents;
  /** Deterministic key that makes the write idempotent. */
  idempotencyKey: string;
}

export interface AccrualInput {
  invoiceId: string;
  dueDate: Date;
  /** Principal outstanding (rent + charges - payments), EXCLUDING interest. */
  outstandingPrincipalCents: Cents;
  /** Interest already accrued on this invoice (for cap enforcement). */
  alreadyAccruedCents: Cents;
  /** Last date already accrued, or null if never. */
  lastAccrualDate: Date | null;
  /** Accrue up to and including this date (normally "today" in SGT). */
  through: Date;
  policy: InterestPolicy;
}

export interface AccrualResult {
  days: AccrualDay[];
  totalChargeCents: Cents;
  /** True if the cap stopped accrual short of `through`. */
  capReached: boolean;
}

const MS_PER_DAY = 86_400_000;

/** Normalise to UTC midnight so date arithmetic can't drift on DST/tz edges. */
export function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(toUtcMidnight(d).getTime() + days * MS_PER_DAY);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / MS_PER_DAY);
}

/** ISO date portion only: 2026-08-06 */
export function isoDate(d: Date): string {
  return toUtcMidnight(d).toISOString().slice(0, 10);
}

/**
 * The first date on which interest may be charged.
 * Grace is inclusive: with a 3-day grace on a 10 Aug due date, the customer
 * has 11/12/13 Aug free and is first charged for 14 Aug.
 */
export function firstAccrualDate(dueDate: Date, gracePeriodDays: number): Date {
  return addDays(dueDate, Math.max(0, gracePeriodDays) + 1);
}

/**
 * Compute every un-accrued day of interest between the last accrual and
 * `through`, inclusive. Returns an empty list when nothing is owed — the
 * caller writes zero ledger entries and the job is a clean no-op.
 */
export function calculateAccrual(input: AccrualInput): AccrualResult {
  const {
    invoiceId,
    dueDate,
    outstandingPrincipalCents,
    alreadyAccruedCents,
    lastAccrualDate,
    through,
    policy,
  } = input;

  const empty: AccrualResult = { days: [], totalChargeCents: ZERO, capReached: false };

  // Nothing owed -> nothing to charge. Also guards against negative principal
  // from an overpayment, which must never generate interest.
  const principal = nonNegative(outstandingPrincipalCents);
  if (principal === ZERO) return empty;
  if (policy.dailyRateBps <= 0) return empty;

  const start = lastAccrualDate
    ? addDays(lastAccrualDate, 1)
    : firstAccrualDate(dueDate, policy.gracePeriodDays);

  const end = toUtcMidnight(through);
  if (end < start) return empty;

  // Enforce the cap on TOTAL interest for this invoice, not per day.
  const capCents =
    policy.capBps && policy.capBps > 0 ? applyBps(principal, policy.capBps) : null;
  let accruedSoFar = alreadyAccruedCents;
  let capReached = false;

  const days: AccrualDay[] = [];
  let total = ZERO;

  const dayCount = daysBetween(start, end) + 1;
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i);

    if (capCents !== null && accruedSoFar >= capCents) {
      capReached = true;
      break;
    }

    let charge = applyBps(principal, policy.dailyRateBps);

    // Partial final day: charge only up to the cap, never past it.
    if (capCents !== null && accruedSoFar + charge > capCents) {
      charge = capCents - accruedSoFar;
      capReached = true;
    }

    if (charge <= ZERO) break;

    days.push({
      date,
      principalCents: principal,
      chargeCents: charge,
      idempotencyKey: `interest:${invoiceId}:${isoDate(date)}`,
    });

    accruedSoFar += charge;
    total += charge;

    if (capReached) break;
  }

  return { days, totalChargeCents: total, capReached };
}

/**
 * Days an invoice is overdue as at `asOf`. Negative means not yet due.
 * This drives the Collections ageing buckets, so it must agree exactly with
 * the accrual logic's notion of a day.
 */
export function daysOverdue(dueDate: Date, asOf: Date = new Date()): number {
  return daysBetween(dueDate, asOf);
}

export type AgeingBucket =
  | 'UPCOMING_7' // due within the next 7 days
  | 'DUE_TODAY'
  | 'OVERDUE_1_7'
  | 'OVERDUE_8_PLUS'
  | 'NOT_DUE';

/** Bucket an invoice for the Collections Dashboard traffic-light view. */
export function ageingBucket(dueDate: Date, asOf: Date = new Date()): AgeingBucket {
  const d = daysOverdue(dueDate, asOf);
  if (d === 0) return 'DUE_TODAY';
  if (d > 0) return d <= 7 ? 'OVERDUE_1_7' : 'OVERDUE_8_PLUS';
  return d >= -7 ? 'UPCOMING_7' : 'NOT_DUE';
}
