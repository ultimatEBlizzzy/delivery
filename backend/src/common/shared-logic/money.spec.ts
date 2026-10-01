import {
  formatZAR,
  fromCents,
  normalizeSaPhone,
  percentOfCents,
  roundMoney,
  toCents,
} from '@hardware-delivery/shared';

describe('money helpers', () => {
  it('converts to integer cents without floating point error', () => {
    expect(toCents(109.99)).toBe(10999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.005)).toBe(101); // half-up on the decimal representation
    expect(toCents(19.99 * 3)).toBe(5997);
    expect(toCents(0)).toBe(0);
  });

  it('round-trips amounts', () => {
    for (const amount of [0.01, 9.99, 109.99, 1250, 99999.99])
      expect(fromCents(toCents(amount))).toBe(amount);
  });

  it('rejects non-finite amounts', () => {
    expect(() => toCents(NaN)).toThrow(RangeError);
    expect(() => toCents(Infinity)).toThrow(RangeError);
  });

  it('sums line totals exactly (no 0.30000000000000004)', () => {
    const lines = [109.99, 109.99, 109.99, 0.1, 0.2];
    const total = fromCents(lines.reduce((acc, v) => acc + toCents(v), 0));
    expect(total).toBe(330.27);
  });

  it('calculates percentages in cents, rounding half up', () => {
    expect(percentOfCents(10999, 3)).toBe(330); // 329.97 -> 330
    expect(percentOfCents(10000, 10)).toBe(1000);
    expect(percentOfCents(5, 50)).toBe(3); // 2.5 -> 3
    expect(roundMoney(12.345)).toBe(12.35);
  });

  it('formats Rands like the product spec', () => {
    expect(formatZAR(109.99)).toBe('R109.99');
    expect(formatZAR(1250)).toBe('R1,250.00');
    expect(formatZAR(0)).toBe('R0.00');
    expect(formatZAR(-5)).toBe('-R5.00');
    expect(formatZAR(null)).toBe('–');
  });
});

describe('South African phone numbers', () => {
  it.each([
    ['082 123 4567', '+27821234567'],
    ['0821234567', '+27821234567'],
    ['+27 82 123 4567', '+27821234567'],
    ['27821234567', '+27821234567'],
    ['(011) 555-1234', '+27115551234'],
  ])('normalises %s', (input, expected) => expect(normalizeSaPhone(input)).toBe(expected));

  it.each(['12345', '+1 202 555 0100', '08212345', 'abc', '0921234567'])('rejects %s', (input) =>
    expect(normalizeSaPhone(input)).toBeNull(),
  );
});
