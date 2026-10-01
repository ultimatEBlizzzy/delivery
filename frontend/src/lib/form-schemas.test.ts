import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  coordField,
  decimalField,
  intField,
  moneyField,
  optionalDecimalField,
  optionalIntField,
  optionalMoneyField,
  parseNumber,
  saleBelowPrice,
  toNullableNumber,
} from './form-schemas';

const ok = (schema: z.ZodTypeAny, value: string) => schema.safeParse(value).success;

describe('money fields', () => {
  it('accepts valid Rand amounts with up to two decimals (dot or comma)', () => {
    for (const v of ['109.99', '1250', '0.50', '99,99', ' 42 '])
      expect(ok(moneyField('Price'), v)).toBe(true);
  });

  it.each(['', '0', '0.00', '-5', '10.999', 'abc', '1e3', '12,5,5', '100000000'])(
    'rejects %j',
    (v) => {
      expect(ok(moneyField('Price'), v)).toBe(false);
    },
  );

  it('optional money allows blank but still validates when present', () => {
    expect(ok(optionalMoneyField('Sale price'), '')).toBe(true);
    expect(ok(optionalMoneyField('Sale price'), '99.99')).toBe(true);
    expect(ok(optionalMoneyField('Sale price'), '0')).toBe(false);
    expect(ok(optionalMoneyField('Sale price'), 'free')).toBe(false);
  });

  it('puts the field name in the message', () => {
    const r = moneyField('Price').safeParse('');
    expect(!r.success && r.error.issues[0].message).toBe('Price is required');
  });
});

describe('number fields', () => {
  it('validates whole numbers and bounds', () => {
    expect(ok(intField('Quantity', 1, 10), '5')).toBe(true);
    expect(ok(intField('Quantity', 1, 10), '0')).toBe(false);
    expect(ok(intField('Quantity', 1, 10), '11')).toBe(false);
    expect(ok(intField('Quantity', 1, 10), '2.5')).toBe(false);
    expect(ok(intField('Quantity', 1, 10), '')).toBe(false);
  });

  it('optional ints allow blank', () => {
    expect(ok(optionalIntField('Maximum'), '')).toBe(true);
    expect(ok(optionalIntField('Maximum'), '25')).toBe(true);
    expect(ok(optionalIntField('Maximum'), '0')).toBe(false);
  });

  it('validates weights with a decimal-place limit', () => {
    expect(ok(decimalField('Weight', 0, 1000, 3), '12.345')).toBe(true);
    expect(ok(decimalField('Weight', 0, 1000, 3), '12.3456')).toBe(false);
    expect(ok(decimalField('Weight', 0, 1000, 3), '-1')).toBe(false);
    expect(ok(decimalField('Weight', 0, 1000, 3), '1001')).toBe(false);
    expect(ok(optionalDecimalField('Length'), '')).toBe(true);
    expect(ok(optionalDecimalField('Length'), '60.5')).toBe(true);
    expect(ok(optionalDecimalField('Length'), '60.55')).toBe(false);
  });

  it('validates coordinates, including negatives (South Africa is south of the equator)', () => {
    const lat = coordField('Latitude', -90, 90);
    expect(ok(lat, '-23.0167')).toBe(true);
    expect(ok(lat, '-91')).toBe(false);
    expect(ok(lat, 'north')).toBe(false);
    expect(ok(coordField('Longitude', -180, 180), '30.6781')).toBe(true);
    expect(ok(coordField('Longitude', -180, 180), '181')).toBe(false);
  });
});

describe('conversions', () => {
  it('parses decimal commas and trims', () => {
    expect(parseNumber(' 12,50 ')).toBe(12.5);
    expect(toNullableNumber('')).toBeNull();
    expect(toNullableNumber(' 7 ')).toBe(7);
  });

  it('compares sale vs regular price in cents', () => {
    expect(saleBelowPrice('100', '99.99')).toBe(true);
    expect(saleBelowPrice('100', '100')).toBe(false);
    expect(saleBelowPrice('100', '120')).toBe(false);
    expect(saleBelowPrice('100', '')).toBe(true); // no sale price
    expect(saleBelowPrice('0.3', String(0.1 + 0.2))).toBe(false); // floating point trap
  });
});
