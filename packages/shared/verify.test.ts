/**
 * Dependency-free verification harness for the money-critical logic.
 *
 * Runs on Node's built-in test runner with native TS type-stripping:
 *   node --test packages/shared/verify.test.ts
 *
 * The vitest suite in apps/api/test/ is the real, richer suite. This file
 * exists so the billing maths can be proven with zero installed dependencies —
 * useful in a locked-down CI runner or an air-gapped review.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyBps, roundHalfUp, parseSgdToCents, centsToDecimalString, formatSgd } from './src/money.ts';
import { calculateAccrual, firstAccrualDate, ageingBucket, isoDate } from './src/interest.ts';
import { buildPayNowPayload, verifyPayNowPayload, crc16, sanitiseReference } from './src/paynow.ts';
import { hasPermission } from './src/rbac.ts';
import { parseDayLadder } from './src/policy-defaults.ts';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

test('roundHalfUp rounds .5 away from zero in both directions', () => {
  assert.equal(roundHalfUp(0.5), 1n);
  assert.equal(roundHalfUp(1.5), 2n);
  assert.equal(roundHalfUp(2.4), 2n);
  // The bug this guards: Math.round(-0.5) === -0, which silently under-charges
  // on negative adjustments.
  assert.equal(roundHalfUp(-0.5), -1n);
  assert.equal(roundHalfUp(-1.5), -2n);
});

test('applyBps computes percentage of cents correctly', () => {
  assert.equal(applyBps(10_000n, 100), 100n); // 1% of S$100.00 = S$1.00
  assert.equal(applyBps(80_000n, 100), 800n); // 1% of S$800.00 = S$8.00
  assert.equal(applyBps(0n, 100), 0n);
  // Never charge interest on a credit balance.
  assert.equal(applyBps(-5_000n, 100), 0n);
});

test('applyBps rounds a fractional cent half-up rather than truncating', () => {
  // 1% of S$12.345 -> 0.12345 dollars -> 12.345 cents -> 12 cents
  assert.equal(applyBps(1_234n, 100), 12n);
  // 1% of S$12.35 -> 12.35 cents -> 12 cents
  assert.equal(applyBps(1_235n, 100), 12n);
  // 1% of S$12.50 -> 12.5 cents -> 13 cents (half-up, not truncated to 12)
  assert.equal(applyBps(1_250n, 100), 13n);
});

test('parseSgdToCents accepts operator input and rejects junk', () => {
  assert.equal(parseSgdToCents('1,234.50'), 123_450n);
  assert.equal(parseSgdToCents('S$800'), 80_000n);
  assert.equal(parseSgdToCents('0.05'), 5n);
  assert.throws(() => parseSgdToCents('12.345'));
  assert.throws(() => parseSgdToCents('abc'));
});

test('formatting round-trips', () => {
  assert.equal(centsToDecimalString(123_450n), '1234.50');
  assert.equal(centsToDecimalString(5n), '0.05');
  assert.equal(formatSgd(123_450n), 'S$1,234.50');
});

// ---------------------------------------------------------------------------
// Interest — the highest-risk logic in the platform
// ---------------------------------------------------------------------------

const POLICY = { dailyRateBps: 100, gracePeriodDays: 3 }; // 1%/day, 3-day grace

test('grace period boundary is exact: first charge is the day after grace ends', () => {
  // Due 10 Aug + 3 days grace -> 11, 12, 13 Aug are free -> first charge 14 Aug
  assert.equal(isoDate(firstAccrualDate(d('2026-08-10'), 3)), '2026-08-14');
});

test('no interest accrues during the grace period', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1',
    dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n,
    alreadyAccruedCents: 0n,
    lastAccrualDate: null,
    through: d('2026-08-13'), // last free day
    policy: POLICY,
  });
  assert.equal(r.days.length, 0);
  assert.equal(r.totalChargeCents, 0n);
});

test('worked example: S$800 weekly rent, 1%/day, 5 days past grace', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1',
    dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n,
    alreadyAccruedCents: 0n,
    lastAccrualDate: null,
    through: d('2026-08-18'), // 14,15,16,17,18 Aug = 5 chargeable days
    policy: POLICY,
  });
  assert.equal(r.days.length, 5);
  assert.equal(r.totalChargeCents, 4_000n); // 5 x S$8.00 = S$40.00
  assert.equal(isoDate(r.days[0]!.date), '2026-08-14');
  assert.equal(isoDate(r.days[4]!.date), '2026-08-18');
});

test('interest is SIMPLE: every day charges on principal, never on accrued interest', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1',
    dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n,
    alreadyAccruedCents: 3_000n, // interest already sitting on the invoice
    lastAccrualDate: null,
    through: d('2026-08-16'),
    policy: POLICY,
  });
  // Every single day must be exactly 1% of the PRINCIPAL. If any day differs,
  // something has started compounding.
  for (const day of r.days) {
    assert.equal(day.chargeCents, 800n);
    assert.equal(day.principalCents, 80_000n);
  }
});

test('a partial payment lowers future accrual but never rewrites past days', () => {
  const before = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n, alreadyAccruedCents: 0n,
    lastAccrualDate: null, through: d('2026-08-15'), policy: POLICY,
  });
  assert.equal(before.totalChargeCents, 1_600n); // 14,15 Aug @ S$8

  // Customer pays S$300 on 15 Aug; principal drops to S$500.
  const after = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 50_000n, alreadyAccruedCents: 1_600n,
    lastAccrualDate: d('2026-08-15'), through: d('2026-08-17'), policy: POLICY,
  });
  assert.equal(after.days.length, 2); // 16, 17 Aug
  assert.equal(after.totalChargeCents, 1_000n); // 2 x S$5.00, not S$8.00
  assert.equal(isoDate(after.days[0]!.date), '2026-08-16');
});

test('re-running an already-accrued period writes nothing (idempotent)', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n, alreadyAccruedCents: 4_000n,
    lastAccrualDate: d('2026-08-18'), through: d('2026-08-18'), policy: POLICY,
  });
  assert.equal(r.days.length, 0);
});

test('idempotency keys are deterministic and unique per invoice-day', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_abc', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n, alreadyAccruedCents: 0n,
    lastAccrualDate: null, through: d('2026-08-16'), policy: POLICY,
  });
  assert.equal(r.days[0]!.idempotencyKey, 'interest:inv_abc:2026-08-14');
  assert.equal(new Set(r.days.map((x) => x.idempotencyKey)).size, r.days.length);
});

test('back-fills correctly after multi-day downtime', () => {
  // Worker was down 5 days; the next run must charge every missed day, once.
  const r = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n, alreadyAccruedCents: 800n,
    lastAccrualDate: d('2026-08-14'), through: d('2026-08-19'), policy: POLICY,
  });
  assert.equal(r.days.length, 5); // 15,16,17,18,19
  assert.equal(r.totalChargeCents, 4_000n);
});

test('a fully paid invoice accrues nothing', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 0n, alreadyAccruedCents: 4_000n,
    lastAccrualDate: d('2026-08-18'), through: d('2026-09-30'), policy: POLICY,
  });
  assert.equal(r.days.length, 0);
});

test('an overpaid (negative principal) invoice never generates interest', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: -5_000n, alreadyAccruedCents: 0n,
    lastAccrualDate: null, through: d('2026-09-30'), policy: POLICY,
  });
  assert.equal(r.days.length, 0);
});

test('interest cap halts accrual and never overshoots', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n, alreadyAccruedCents: 0n,
    lastAccrualDate: null, through: d('2026-12-31'),
    policy: { ...POLICY, capBps: 500 }, // cap total interest at 5% of principal
  });
  assert.equal(r.capReached, true);
  assert.equal(r.totalChargeCents, 4_000n); // exactly 5% of S$800, not a cent more
});

test('a zero rate disables interest entirely', () => {
  const r = calculateAccrual({
    invoiceId: 'inv_1', dueDate: d('2026-08-10'),
    outstandingPrincipalCents: 80_000n, alreadyAccruedCents: 0n,
    lastAccrualDate: null, through: d('2026-09-30'),
    policy: { dailyRateBps: 0, gracePeriodDays: 3 },
  });
  assert.equal(r.days.length, 0);
});

test('ageing buckets match the Collections traffic lights', () => {
  const today = d('2026-08-20');
  assert.equal(ageingBucket(d('2026-08-20'), today), 'DUE_TODAY');
  assert.equal(ageingBucket(d('2026-08-19'), today), 'OVERDUE_1_7');
  assert.equal(ageingBucket(d('2026-08-13'), today), 'OVERDUE_1_7'); // exactly 7
  assert.equal(ageingBucket(d('2026-08-12'), today), 'OVERDUE_8_PLUS');
  assert.equal(ageingBucket(d('2026-08-25'), today), 'UPCOMING_7');
  assert.equal(ageingBucket(d('2026-09-30'), today), 'NOT_DUE');
});

// ---------------------------------------------------------------------------
// PayNow SGQR
// ---------------------------------------------------------------------------

test('crc16 is a correct CRC-16/CCITT-FALSE implementation', () => {
  // "123456789" is the standard check value for every catalogued CRC variant.
  // CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no final xor)
  // must produce exactly 0x29B1. This is the authoritative proof that the
  // algorithm is right — a QR with a bad CRC scans fine and is then rejected
  // by every bank app with an unhelpful error, so this must not drift.
  assert.equal(crc16('123456789'), '29B1');
  // Determinism and case of the hex output.
  assert.equal(crc16('123456789'), crc16('123456789'));
  assert.equal(crc16(''), 'FFFF');
});

test('generated PayNow payload passes its own checksum', () => {
  const payload = buildPayNowPayload({
    uen: '202512345K',
    merchantName: 'VIDA PARTNERS PTE LTD',
    amountCents: 80_000n,
    reference: 'VP-INV-2026-004312',
  });
  assert.equal(verifyPayNowPayload(payload), true);
});

test('payload embeds SGD, Singapore, the exact amount and a locked amount flag', () => {
  const payload = buildPayNowPayload({
    uen: '202512345K',
    merchantName: 'VIDA PARTNERS PTE LTD',
    amountCents: 80_000n,
    reference: 'VP-INV-2026-004312',
  });
  assert.ok(payload.startsWith('000201'));
  // Field 01, length 02, value 12 = dynamic QR (amount baked in, single use).
  assert.ok(payload.includes('010212'));
  assert.ok(payload.includes('SG.PAYNOW'));
  assert.ok(payload.includes('5303702')); // SGD
  assert.ok(payload.includes('5802SG'));
  assert.ok(payload.includes('5406800.00')); // amount, field 54, length 06
  assert.ok(payload.includes('VPINV2026004312')); // sanitised reference
});

test('a tampered payload fails verification', () => {
  const payload = buildPayNowPayload({
    uen: '202512345K', merchantName: 'VIDA PARTNERS PTE LTD',
    amountCents: 80_000n, reference: 'VP-INV-1',
  });
  // Flip the amount from 800.00 to 900.00 and the CRC must no longer match.
  assert.equal(verifyPayNowPayload(payload.replace('5406800.00', '5406900.00')), false);
});

test('reference sanitisation strips punctuation banks would mangle', () => {
  assert.equal(sanitiseReference('VP-INV-2026-004312'), 'VPINV2026004312');
  assert.equal(sanitiseReference('inv/123 456'), 'INV123456');
  assert.throws(() => sanitiseReference('---'));
});

// ---------------------------------------------------------------------------
// RBAC — separation of duty is a control, not a formality
// ---------------------------------------------------------------------------

test('OPERATIONS can move vehicles but cannot approve money', () => {
  assert.equal(hasPermission('OPERATIONS', 'vehicle.status_change'), true);
  assert.equal(hasPermission('OPERATIONS', 'payment.verify'), false);
  assert.equal(hasPermission('OPERATIONS', 'interest.waive'), false);
});

test('ACCOUNTS can approve money but cannot mutate the fleet', () => {
  assert.equal(hasPermission('ACCOUNTS', 'payment.verify'), true);
  assert.equal(hasPermission('ACCOUNTS', 'invoice.write_off'), true);
  assert.equal(hasPermission('ACCOUNTS', 'vehicle.update'), false);
  assert.equal(hasPermission('ACCOUNTS', 'vehicle.status_change'), false);
});

test('VIEWER is read-only and cannot bulk-export PII', () => {
  assert.equal(hasPermission('VIEWER', 'report.read'), true);
  assert.equal(hasPermission('VIEWER', 'report.export'), false);
  assert.equal(hasPermission('VIEWER', 'customer.write'), false);
  assert.equal(hasPermission('VIEWER', 'payment.verify'), false);
});

test('only SUPER_ADMIN can change business policy or manage users', () => {
  assert.equal(hasPermission('SUPER_ADMIN', 'policy.manage'), true);
  for (const role of ['OPERATIONS', 'ACCOUNTS', 'BRANCH_MANAGER', 'VIEWER']) {
    assert.equal(hasPermission(role, 'policy.manage'), false, `${role} must not manage policy`);
    assert.equal(hasPermission(role, 'user.manage'), false, `${role} must not manage users`);
  }
});

test('BRANCH_MANAGER combines ops and accounts duties', () => {
  assert.equal(hasPermission('BRANCH_MANAGER', 'vehicle.status_change'), true);
  assert.equal(hasPermission('BRANCH_MANAGER', 'payment.verify'), true);
  assert.equal(hasPermission('BRANCH_MANAGER', 'rental.terminate'), true);
});

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

test('reminder ladders parse, sort and de-duplicate', () => {
  assert.deepEqual(parseDayLadder('30,14,7'), [30, 14, 7]);
  assert.deepEqual(parseDayLadder('7, 30 ,14,14'), [30, 14, 7]);
  assert.deepEqual(parseDayLadder('90,60,30,7'), [90, 60, 30, 7]);
});
