/**
 * Money primitives for the Karrkarr platform.
 *
 * RULE: every monetary value in this system is an integer number of SGD cents
 * held in a `bigint`. Floating point never touches the billing path. If you
 * find yourself writing `* 0.01` outside this file, stop.
 */

export type Cents = bigint;

/** Basis points. 10_000 bps = 100%. 100 bps = 1%. */
export type Bps = number;

export const ZERO: Cents = 0n;

/**
 * Round half-up to the nearest cent. JS `Math.round` rounds -0.5 towards zero,
 * which silently under-charges on negative adjustments, so we do it explicitly.
 */
export function roundHalfUp(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot round non-finite value: ${value}`);
  }
  const rounded = value < 0 ? -Math.round(-value) : Math.round(value);
  return BigInt(rounded);
}

/**
 * Apply a basis-point rate to a cent amount, rounding half-up.
 *
 * Used by the daily interest accrual. Deliberately computed in Number space
 * and rounded once: bigint has no fractional part, and doing the division in
 * bigint would truncate every daily charge towards zero, quietly losing the
 * company money on every invoice, every day.
 *
 *   applyBps(100_00n, 100) === 1_00n   // 1% of S$100.00 = S$1.00
 */
export function applyBps(amount: Cents, bps: Bps): Cents {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new RangeError(`Invalid basis points: ${bps}`);
  }
  if (amount <= ZERO) return ZERO;
  return roundHalfUp(Number(amount) * (bps / 10_000));
}

/** 12_345n -> "123.45" */
export function centsToDecimalString(cents: Cents): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const dollars = abs / 100n;
  const remainder = abs % 100n;
  return `${negative ? '-' : ''}${dollars}.${remainder.toString().padStart(2, '0')}`;
}

/** 12_345n -> "S$123.45" */
export function formatSgd(cents: Cents): string {
  return `S$${Number(centsToDecimalString(cents)).toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parse operator input ("1,234.50", "$1234.5", "1234") into cents.
 * Throws rather than guessing — a mistyped rent should fail loudly.
 */
export function parseSgdToCents(input: string): Cents {
  const cleaned = input.replace(/[\s,S$]/gi, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new RangeError(`Not a valid SGD amount: "${input}"`);
  }
  const negative = cleaned.startsWith('-');
  const [dollars, fraction = ''] = cleaned.replace('-', '').split('.');
  const cents = BigInt(dollars) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = ZERO;
  for (const v of values) total += v;
  return total;
}

/** Clamp to zero — outstanding balances must never render negative. */
export function nonNegative(cents: Cents): Cents {
  return cents < ZERO ? ZERO : cents;
}
