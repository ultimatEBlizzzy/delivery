import { toCents } from '@hardware-delivery/shared';
import { hasAtMostTwoDecimals } from '../../common/utils/decimal';

export const MAX_PRICE = 10_000_000;

export interface ListingRuleInput {
  price: number;
  salePrice?: number | null;
  minimumQuantity: number;
  maximumQuantity?: number | null;
  lowStockThreshold?: number;
}

/**
 * Business rules for a store's offer. Returns human-readable problems (empty = valid).
 * The same invariants are enforced by database CHECK constraints as a last line of defence.
 */
export function validateListingRules(input: ListingRuleInput): string[] {
  const problems: string[] = [];
  const { price, salePrice, minimumQuantity, maximumQuantity, lowStockThreshold } = input;

  if (!Number.isFinite(price) || price <= 0) problems.push('Price must be greater than R0');
  else if (price > MAX_PRICE)
    problems.push(`Price cannot exceed R${MAX_PRICE.toLocaleString('en-ZA')}`);
  else if (!hasAtMostTwoDecimals(price)) problems.push('Price can have at most 2 decimal places');

  if (salePrice !== null && salePrice !== undefined) {
    if (!Number.isFinite(salePrice) || salePrice <= 0)
      problems.push('Sale price must be greater than R0');
    else if (!hasAtMostTwoDecimals(salePrice))
      problems.push('Sale price can have at most 2 decimal places');
    else if (Number.isFinite(price) && toCents(salePrice) >= toCents(price)) {
      problems.push('Sale price must be lower than the regular price');
    }
  }

  if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1)
    problems.push('Minimum order quantity must be at least 1');
  if (maximumQuantity !== null && maximumQuantity !== undefined) {
    if (!Number.isInteger(maximumQuantity) || maximumQuantity < 1)
      problems.push('Maximum order quantity must be at least 1');
    else if (Number.isInteger(minimumQuantity) && maximumQuantity < minimumQuantity) {
      problems.push('Maximum order quantity cannot be lower than the minimum');
    }
  }
  if (
    lowStockThreshold !== undefined &&
    (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)
  ) {
    problems.push('Low-stock threshold cannot be negative');
  }
  return problems;
}
