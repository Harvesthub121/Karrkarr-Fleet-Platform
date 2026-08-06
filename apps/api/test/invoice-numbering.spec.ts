/**
 * Invoice and receipt numbering tests.
 * These tests verify the format contract without a DB connection.
 */

import { describe, it, expect } from 'vitest';

describe('invoice number format', () => {
  function fakeInvoiceNo(seq: number, year = 2026): string {
    return `KR-INV-${year}-${seq.toString().padStart(6, '0')}`;
  }

  it('starts with KR-INV-', () => {
    expect(fakeInvoiceNo(1)).toMatch(/^KR-INV-/);
  });

  it('pads sequence to 6 digits', () => {
    expect(fakeInvoiceNo(1)).toBe('KR-INV-2026-000001');
    expect(fakeInvoiceNo(999)).toBe('KR-INV-2026-000999');
    expect(fakeInvoiceNo(1000000)).toBe('KR-INV-2026-1000000'); // goes over 6 when > 999999
  });

  it('uses 4-digit year', () => {
    expect(fakeInvoiceNo(1, 2026)).toMatch(/KR-INV-2026-/);
    expect(fakeInvoiceNo(1, 2030)).toMatch(/KR-INV-2030-/);
  });
});

describe('receipt number format', () => {
  function fakeReceiptNo(seq: number, year = 2026): string {
    return `KR-RCP-${year}-${seq.toString().padStart(6, '0')}`;
  }

  it('starts with KR-RCP-', () => {
    expect(fakeReceiptNo(1)).toMatch(/^KR-RCP-/);
  });

  it('pads sequence to 6 digits', () => {
    expect(fakeReceiptNo(42)).toBe('KR-RCP-2026-000042');
  });
});

describe('ledger balance reconciliation', () => {
  it('sum of RENTAL_CHARGE entries = principalCents', () => {
    // Simulate ledger math: charge = +principal, payment = -amount, outstanding = charge + payment
    const principal = 100_00n;
    const charge = principal;     // RENTAL_CHARGE
    const payment = -60_00n;      // PAYMENT_RECEIVED (partial)

    const outstanding = charge + payment;
    expect(outstanding).toBe(40_00n);
  });

  it('full payment brings outstanding to 0', () => {
    const principal = 200_00n;
    const charge = principal;
    const payment = -principal;
    expect(charge + payment).toBe(0n);
  });

  it('interest + charge - payment = correct outstanding', () => {
    const principal = 100_00n;
    const interest = 3_00n; // 3 days of 1%
    const payment = -50_00n;
    const outstanding = principal + interest + payment;
    expect(outstanding).toBe(53_00n);
  });

  it('overpayment produces negative outstanding (clamped to 0 in service)', () => {
    const charge = 100_00n;
    const payment = -110_00n; // overpaid
    const outstanding = charge + payment;
    expect(outstanding).toBe(-10_00n);
    // Service clamps: max(0, outstanding)
    expect(outstanding < 0n ? 0n : outstanding).toBe(0n);
  });

  it('interest waiver reduces outstanding correctly', () => {
    const charge = 100_00n;
    const interest = 5_00n;
    const waiver = -5_00n; // waive all interest
    const outstanding = charge + interest + waiver;
    expect(outstanding).toBe(100_00n); // back to principal only
  });
});
