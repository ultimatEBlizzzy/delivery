import { redact } from './audit.service';

describe('audit redaction', () => {
  it('drops sensitive keys at any depth', () => {
    const result = redact({
      email: 'a@b.co',
      passwordHash: 'x',
      nested: { refreshToken: 't', accessToken: 'a', apiSecret: 's', cardNumber: '4111', ok: 1 },
      list: [{ password: 'p', name: 'n' }],
    });
    expect(result).toEqual({ email: 'a@b.co', nested: { ok: 1 }, list: [{ name: 'n' }] });
  });

  it('serialises dates, truncates deep structures and handles nullish values', () => {
    expect(redact(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeNull();
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
  });
});
