import { toCents } from '@hardware-delivery/shared';

/** True when `value` is a finite number with at most 2 decimal places (a valid Rand amount). */
export function hasAtMostTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value * 100 - toCents(value)) < 1e-6;
}
