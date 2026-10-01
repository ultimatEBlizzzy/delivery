/**
 * Money helpers. All business arithmetic is performed on INTEGER CENTS to avoid binary
 * floating-point drift (e.g. 109.99 * 3). Amounts cross the API as Rand numbers with at most
 * two decimals (matching the NUMERIC(12,2) database columns).
 */

/** Convert a Rand amount to integer cents without floating point error. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`Invalid money amount: ${amount}`);
  // toPrecision strips representation noise such as 10998.999999999998
  return Math.round(Number((amount * 100).toPrecision(15)));
}

/** Convert integer cents back to a Rand amount (always an exact 2-decimal value). */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Round a Rand amount to 2 decimals. */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

/** Percentage of an amount in cents, rounded half-up to the nearest cent. */
export function percentOfCents(cents: number, percent: number): number {
  return Math.round(Number(((cents * percent) / 100).toPrecision(15)));
}

/** Format a Rand amount the way the product spec shows prices: R109.99 / R1,250.00 */
export function formatZAR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '–';
  const negative = amount < 0;
  const body = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? '-' : ''}R${body}`;
}
