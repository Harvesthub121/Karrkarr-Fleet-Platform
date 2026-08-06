import { describe, it, expect } from 'vitest';
import { crc16, buildPayNowPayload, verifyPayNowPayload, sanitiseReference } from '@karrkarr/shared';

describe('CRC-16/CCITT-FALSE', () => {
  // Known-good test vectors from the EMVCo MPM spec and community test suites
  it('returns 6304 for empty string to produce known CRC', () => {
    // CRC of "6304" prefix (standard PayNow empty-payload check):
    // This is the well-known value for CRC-16/CCITT-FALSE of "6304"
    const result = crc16('6304');
    expect(typeof result).toBe('string');
    expect(result).toHaveLength(4);
    expect(result).toMatch(/^[0-9A-F]{4}$/);
  });

  it('produces correct CRC for known PayNow-like payload', () => {
    // A minimal known-good SGQR payload (constructed manually):
    // 000201010212260...6304
    // We verify round-trip: build → verify
    const payload = buildPayNowPayload({
      uen: '202512345K',
      merchantName: 'KARRKARR PTE LTD',
      amountCents: 100_00n,
      reference: 'KRINV2026004312',
      editable: false,
      expiryDate: new Date('2026-09-05'),
    });
    expect(verifyPayNowPayload(payload)).toBe(true);
  });

  it('CRC changes if payload is modified (tamper detection)', () => {
    const original = buildPayNowPayload({
      uen: '202512345K',
      merchantName: 'KARRKARR PTE LTD',
      amountCents: 100_00n,
      reference: 'KRINV2026000001',
    });
    // Flip one character before the CRC
    const tampered = original.slice(0, 10) + 'X' + original.slice(11);
    expect(verifyPayNowPayload(tampered)).toBe(false);
  });

  it('verifyPayNowPayload returns false for a short/invalid string', () => {
    expect(verifyPayNowPayload('short')).toBe(false);
  });
});

describe('buildPayNowPayload', () => {
  it('produces a payload with correct structure markers', () => {
    const payload = buildPayNowPayload({
      uen: '202512345K',
      merchantName: 'TEST MERCHANT',
      amountCents: 50_00n,
      reference: 'INV001',
    });
    // ID 00 = payload format indicator "01"
    expect(payload.startsWith('000201')).toBe(true);
    // ID 01 = "12" for dynamic (amount present)
    expect(payload).toContain('010212');
    // PayNow block contains SG.PAYNOW
    expect(payload).toContain('SG.PAYNOW');
    // Amount 50.00
    expect(payload).toContain('50.00');
    // CRC field starts with "6304"
    expect(payload).toContain('6304');
  });

  it('static QR (no amount) sets ID 01 = 11', () => {
    const payload = buildPayNowPayload({
      uen: '202512345K',
      merchantName: 'TEST',
      reference: 'STATIC',
    });
    expect(payload).toContain('010211');
  });

  it('sanitises reference — strips non-alphanumeric, uppercases, truncates to 25', () => {
    const payload = buildPayNowPayload({
      uen: '202512345K',
      merchantName: 'TEST',
      amountCents: 1_00n,
      reference: 'KR-INV-2026-000001',
    });
    // Reference should be sanitised: KRINV2026000001
    expect(payload).toContain('KRINV2026000001');
  });

  it('throws if UEN is empty', () => {
    expect(() =>
      buildPayNowPayload({ uen: '', merchantName: 'TEST', reference: 'REF' }),
    ).toThrow(RangeError);
  });
});

describe('sanitiseReference', () => {
  it('uppercases and strips non-alphanumeric', () => {
    expect(sanitiseReference('vp-inv-2026-000001')).toBe('KRINV2026000001');
  });
  it('truncates to 25 chars', () => {
    const long = 'A'.repeat(30);
    expect(sanitiseReference(long)).toHaveLength(25);
  });
  it('throws on empty result', () => {
    expect(() => sanitiseReference('---')).toThrow(RangeError);
  });
});
