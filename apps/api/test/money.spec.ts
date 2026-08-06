import { describe, it, expect } from 'vitest';
import { roundHalfUp, applyBps, centsToDecimalString, parseSgdToCents, formatSgd } from '@vida/shared';

describe('roundHalfUp', () => {
  it('rounds 0.5 up to 1', () => expect(roundHalfUp(0.5)).toBe(1n));
  it('rounds 1.5 up to 2', () => expect(roundHalfUp(1.5)).toBe(2n));
  it('rounds 2.5 up to 3', () => expect(roundHalfUp(2.5)).toBe(3n));
  it('rounds -0.5 to -1 (half-up = away from zero for negatives)', () => {
    // half-up: -0.5 rounds to -0.5 → -1 (towards negative infinity)
    expect(roundHalfUp(-0.5)).toBe(-1n);
  });
  it('rounds -1.5 to -2', () => expect(roundHalfUp(-1.5)).toBe(-2n));
  it('rounds 0.4 down to 0', () => expect(roundHalfUp(0.4)).toBe(0n));
  it('rounds exactly integers', () => expect(roundHalfUp(42)).toBe(42n));
  it('throws on NaN', () => expect(() => roundHalfUp(NaN)).toThrow(RangeError));
  it('throws on Infinity', () => expect(() => roundHalfUp(Infinity)).toThrow(RangeError));
});

describe('applyBps', () => {
  it('1% of S$100 = S$1', () => expect(applyBps(100_00n, 100)).toBe(100n));
  it('1% of S$230 = S$2.30 = 230 cents', () => expect(applyBps(230_00n, 100)).toBe(230n));
  it('0 bps returns 0', () => expect(applyBps(100_00n, 0)).toBe(0n));
  it('amount=0 returns 0', () => expect(applyBps(0n, 100)).toBe(0n));
  it('negative amount returns 0 (guarded)', () => expect(applyBps(-100n, 100)).toBe(0n));
  it('10000 bps = 100% of principal', () => expect(applyBps(100_00n, 10000)).toBe(100_00n));
  it('half-up rounding on fractional cents', () => {
    // 1% of S$0.50 = S$0.005 = 0.5 cents → rounds up to 1 cent
    expect(applyBps(50n, 100)).toBe(1n);
  });
  it('throws on negative bps', () => expect(() => applyBps(100n, -1)).toThrow(RangeError));
  it('throws on non-integer bps', () => expect(() => applyBps(100n, 1.5)).toThrow(RangeError));
});

describe('centsToDecimalString', () => {
  it('converts 12345 to "123.45"', () => expect(centsToDecimalString(12345n)).toBe('123.45'));
  it('converts 100 to "1.00"', () => expect(centsToDecimalString(100n)).toBe('1.00'));
  it('converts 0 to "0.00"', () => expect(centsToDecimalString(0n)).toBe('0.00'));
  it('handles negative: -100 to "-1.00"', () => expect(centsToDecimalString(-100n)).toBe('-1.00'));
  it('pads single digit cents: 105 → "1.05"', () => expect(centsToDecimalString(105n)).toBe('1.05'));
});

describe('parseSgdToCents', () => {
  it('parses "100.00" to 10000n', () => expect(parseSgdToCents('100.00')).toBe(10000n));
  it('parses "S$1,234.50" to 123450n', () => expect(parseSgdToCents('S$1,234.50')).toBe(123450n));
  it('parses "1234" (no cents) to 123400n', () => expect(parseSgdToCents('1234')).toBe(123400n));
  it('parses "-50.00" to -5000n', () => expect(parseSgdToCents('-50.00')).toBe(-5000n));
  it('throws on invalid input', () => expect(() => parseSgdToCents('abc')).toThrow(RangeError));
  it('throws on three decimal places', () => expect(() => parseSgdToCents('1.234')).toThrow(RangeError));
});
