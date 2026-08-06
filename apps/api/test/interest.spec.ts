/**
 * Exhaustive tests for the interest accrual engine.
 * These are pure-function tests — no DB, no NestJS container.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAccrual,
  firstAccrualDate,
  addDays,
  toUtcMidnight,
  isoDate,
  type AccrualInput,
} from '@vida/shared';

const RATE_100BPS: import('@vida/shared').InterestPolicy = {
  dailyRateBps: 100, // 1%/day
  gracePeriodDays: 3,
};

function makeInput(overrides: Partial<AccrualInput> = {}): AccrualInput {
  const dueDate = toUtcMidnight(new Date('2026-08-01'));
  return {
    invoiceId: 'inv-test',
    dueDate,
    outstandingPrincipalCents: 100_00n, // S$100.00
    alreadyAccruedCents: 0n,
    lastAccrualDate: null,
    through: addDays(dueDate, 10),
    policy: RATE_100BPS,
    ...overrides,
  };
}

describe('firstAccrualDate', () => {
  it('returns dueDate + gracePeriodDays + 1', () => {
    const due = toUtcMidnight(new Date('2026-08-10'));
    const first = firstAccrualDate(due, 3);
    expect(isoDate(first)).toBe('2026-08-14');
  });

  it('grace=0 means first accrual is dueDate + 1', () => {
    const due = toUtcMidnight(new Date('2026-08-10'));
    expect(isoDate(firstAccrualDate(due, 0))).toBe('2026-08-11');
  });
});

describe('calculateAccrual — basic cases', () => {
  it('returns empty when through < first accrual date (within grace)', () => {
    // due = Aug 1, grace = 3 → first accrual = Aug 5
    // through = Aug 4 (still within grace)
    const through = toUtcMidnight(new Date('2026-08-04'));
    const result = calculateAccrual(makeInput({ through }));
    expect(result.days).toHaveLength(0);
    expect(result.totalChargeCents).toBe(0n);
  });

  it('accrues exactly from firstAccrualDate through `through`', () => {
    // due = Aug 1, grace = 3 → first accrual = Aug 5
    // through = Aug 7 → expect 3 days (Aug 5, 6, 7)
    const through = toUtcMidnight(new Date('2026-08-07'));
    const result = calculateAccrual(makeInput({ through }));
    expect(result.days).toHaveLength(3);
    expect(isoDate(result.days[0].date)).toBe('2026-08-05');
    expect(isoDate(result.days[2].date)).toBe('2026-08-07');
  });

  it('daily charge is 1% of S$100 = S$1.00 = 100 cents', () => {
    const through = toUtcMidnight(new Date('2026-08-05'));
    const result = calculateAccrual(makeInput({ through }));
    expect(result.days).toHaveLength(1);
    expect(result.days[0].chargeCents).toBe(100n);
  });

  it('totalChargeCents sums all days', () => {
    const through = toUtcMidnight(new Date('2026-08-10'));
    // Aug 5 through Aug 10 = 6 days × 100 cents = 600 cents
    const result = calculateAccrual(makeInput({ through }));
    expect(result.days).toHaveLength(6);
    expect(result.totalChargeCents).toBe(600n);
  });
});

describe('idempotent re-run', () => {
  it('returns empty when lastAccrualDate = through (already caught up)', () => {
    const through = toUtcMidnight(new Date('2026-08-10'));
    const result = calculateAccrual(
      makeInput({ lastAccrualDate: through, alreadyAccruedCents: 600n, through }),
    );
    expect(result.days).toHaveLength(0);
  });

  it('picks up exactly the missing days after downtime', () => {
    // Job ran through Aug 8, then was down. Now running for Aug 10.
    // Should produce exactly Aug 9 and Aug 10.
    const lastAccrualDate = toUtcMidnight(new Date('2026-08-08'));
    const through = toUtcMidnight(new Date('2026-08-10'));
    const result = calculateAccrual(
      makeInput({ lastAccrualDate, alreadyAccruedCents: 400n, through }),
    );
    expect(result.days).toHaveLength(2);
    expect(isoDate(result.days[0].date)).toBe('2026-08-09');
    expect(isoDate(result.days[1].date)).toBe('2026-08-10');
  });

  it('re-run with lastAccrualDate = yesterday produces exactly 1 day today', () => {
    const yesterday = toUtcMidnight(new Date('2026-08-09'));
    const today = toUtcMidnight(new Date('2026-08-10'));
    const result = calculateAccrual(
      makeInput({ lastAccrualDate: yesterday, alreadyAccruedCents: 500n, through: today }),
    );
    expect(result.days).toHaveLength(1);
    expect(isoDate(result.days[0].date)).toBe('2026-08-10');
  });
});

describe('grace boundary — exactly', () => {
  it('no charge on day 3 (grace day 3)', () => {
    // due = Aug 1, grace = 3 → Aug 2, 3, 4 are free
    const through = toUtcMidnight(new Date('2026-08-04'));
    const result = calculateAccrual(makeInput({ through }));
    expect(result.days).toHaveLength(0);
  });

  it('charge on day 4 (first day after grace)', () => {
    const through = toUtcMidnight(new Date('2026-08-05'));
    const result = calculateAccrual(makeInput({ through }));
    expect(result.days).toHaveLength(1);
    expect(isoDate(result.days[0].date)).toBe('2026-08-05');
  });
});

describe('partial payment reduces future accrual, not past', () => {
  it('reducing principal does not recalculate past entries', () => {
    // Simulate: 3 days of interest have already been written.
    // Customer then pays half. New outstandingPrincipal = S$50.
    const through = toUtcMidnight(new Date('2026-08-10'));
    const lastAccrualDate = toUtcMidnight(new Date('2026-08-07'));
    const alreadyAccruedCents = 300n; // 3 days × 100 cents

    // After partial payment, principal is halved
    const result = calculateAccrual(
      makeInput({
        outstandingPrincipalCents: 50_00n, // S$50 remaining
        alreadyAccruedCents,
        lastAccrualDate,
        through,
      }),
    );

    // Aug 8, 9, 10 → 3 days at 1% of S$50 = 50 cents/day
    expect(result.days).toHaveLength(3);
    expect(result.days[0].chargeCents).toBe(50n);
    expect(result.totalChargeCents).toBe(150n);
    // Past 3 days were NOT recalculated — that's by design (simple interest)
  });
});

describe('zero/negative principal', () => {
  it('zero principal produces no entries', () => {
    const result = calculateAccrual(makeInput({ outstandingPrincipalCents: 0n }));
    expect(result.days).toHaveLength(0);
  });

  it('negative principal (overpayment) produces no entries', () => {
    const result = calculateAccrual(makeInput({ outstandingPrincipalCents: -100n }));
    expect(result.days).toHaveLength(0);
  });
});

describe('cap enforcement', () => {
  it('stops accruing when cap is reached', () => {
    // Cap at 300 bps = 3% of S$100 = S$3.00 = 300 cents
    // At 100 cents/day, cap hit after 3 days
    const policy = { dailyRateBps: 100, gracePeriodDays: 3, capBps: 300 };
    const through = toUtcMidnight(new Date('2026-08-20'));
    const result = calculateAccrual(makeInput({ policy, through }));
    expect(result.capReached).toBe(true);
    expect(result.totalChargeCents).toBe(300n);
    expect(result.days).toHaveLength(3);
  });

  it('partial final day stops at cap, not over', () => {
    // Cap at 250 bps = 250 cents. Day 3 would try to add 100, hitting cap at day 2.5.
    const policy = { dailyRateBps: 100, gracePeriodDays: 3, capBps: 250 };
    const through = toUtcMidnight(new Date('2026-08-20'));
    const result = calculateAccrual(makeInput({ policy, through }));
    expect(result.capReached).toBe(true);
    expect(result.totalChargeCents).toBe(250n);
    // Last day has a partial charge
    const lastDay = result.days[result.days.length - 1];
    expect(lastDay.chargeCents).toBe(50n);
  });

  it('cap=0 means uncapped (runs all days)', () => {
    const policy = { dailyRateBps: 100, gracePeriodDays: 3, capBps: 0 };
    const through = toUtcMidnight(new Date('2026-08-20'));
    const result = calculateAccrual(makeInput({ policy, through }));
    expect(result.capReached).toBe(false);
    expect(result.days.length).toBeGreaterThan(3);
  });

  it('already-accrued amount counts toward cap', () => {
    // Already 200 cents accrued, cap = 300 → only 100 more allowed
    const policy = { dailyRateBps: 100, gracePeriodDays: 3, capBps: 300 };
    const lastAccrualDate = toUtcMidnight(new Date('2026-08-06'));
    const through = toUtcMidnight(new Date('2026-08-20'));
    const result = calculateAccrual(
      makeInput({ policy, alreadyAccruedCents: 200n, lastAccrualDate, through }),
    );
    expect(result.totalChargeCents).toBe(100n);
    expect(result.capReached).toBe(true);
  });
});

describe('idempotency key format', () => {
  it('keys follow interest:{invoiceId}:{YYYY-MM-DD}', () => {
    const through = toUtcMidnight(new Date('2026-08-05'));
    const result = calculateAccrual(makeInput({ invoiceId: 'inv-abc', through }));
    expect(result.days[0].idempotencyKey).toBe('interest:inv-abc:2026-08-05');
  });
});
