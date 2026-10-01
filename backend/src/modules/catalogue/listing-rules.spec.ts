import { validateListingRules } from './listing-rules';

const valid = {
  price: 109.99,
  salePrice: null,
  minimumQuantity: 1,
  maximumQuantity: null,
  lowStockThreshold: 5,
};

describe('validateListingRules (store-specific pricing rules)', () => {
  it('accepts a normal listing', () => {
    expect(validateListingRules(valid)).toEqual([]);
    expect(validateListingRules({ ...valid, salePrice: 99.99, maximumQuantity: 50 })).toEqual([]);
  });

  it.each([
    ['zero price', { price: 0 }, /greater than R0/],
    ['negative price', { price: -5 }, /greater than R0/],
    ['NaN price', { price: Number.NaN }, /greater than R0/],
    ['absurd price', { price: 99_999_999 }, /cannot exceed/],
    ['price with 3 decimals', { price: 10.999 }, /2 decimal places/],
  ])('rejects %s', (_label, patch, message) => {
    expect(validateListingRules({ ...valid, ...patch }).join('|')).toMatch(message);
  });

  it('requires the sale price to be strictly lower than the price', () => {
    expect(validateListingRules({ ...valid, salePrice: 109.99 }).join()).toMatch(
      /lower than the regular price/,
    );
    expect(validateListingRules({ ...valid, salePrice: 120 }).join()).toMatch(
      /lower than the regular price/,
    );
    expect(validateListingRules({ ...valid, salePrice: 0 }).join()).toMatch(/greater than R0/);
    expect(validateListingRules({ ...valid, salePrice: 109.98 })).toEqual([]);
    expect(validateListingRules({ ...valid, salePrice: 9.999 }).join()).toMatch(/2 decimal places/);
  });

  it('compares prices in cents (no floating point surprises)', () => {
    // 0.1 + 0.2 style values must not slip through as "lower"
    expect(validateListingRules({ ...valid, price: 0.3, salePrice: 0.1 + 0.2 }).join()).toMatch(
      /lower than the regular price/,
    );
  });

  it('validates quantity limits', () => {
    expect(validateListingRules({ ...valid, minimumQuantity: 0 }).join()).toMatch(/at least 1/);
    expect(validateListingRules({ ...valid, minimumQuantity: 1.5 }).join()).toMatch(/at least 1/);
    expect(
      validateListingRules({ ...valid, minimumQuantity: 10, maximumQuantity: 5 }).join(),
    ).toMatch(/cannot be lower than the minimum/);
    expect(validateListingRules({ ...valid, minimumQuantity: 5, maximumQuantity: 5 })).toEqual([]);
    expect(validateListingRules({ ...valid, lowStockThreshold: -1 }).join()).toMatch(
      /cannot be negative/,
    );
  });

  it('reports every problem at once', () => {
    expect(
      validateListingRules({ price: -1, salePrice: -2, minimumQuantity: 0, maximumQuantity: 0 })
        .length,
    ).toBeGreaterThanOrEqual(3);
  });
});
