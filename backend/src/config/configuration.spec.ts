import { ConfigError, loadConfig } from './configuration';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  STORAGE_SIGNING_SECRET: 'b'.repeat(40),
};

const production = {
  ...base,
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://shop.example.co.za',
  PAYMENT_PROVIDER: 'mock',
  ALLOW_MOCK_PROVIDERS_IN_PRODUCTION: 'true',
};

describe('loadConfig', () => {
  it('loads sensible defaults for development', () => {
    const cfg = loadConfig(base);
    expect(cfg).toMatchObject({
      env: 'development',
      port: 3000,
      isProduction: false,
      auth: { accessTtlSeconds: 900, cookieSecure: false, cookieSameSite: 'strict' },
      rateLimit: { enabled: true },
      swagger: { enabled: true },
    });
    expect(cfg.auth.refreshTtlSeconds).toBe(30 * 86400);
    expect(cfg.auth.argon2.memoryCost).toBe(19456); // OWASP minimum outside tests
  });

  it('has no default for secrets: missing or short secrets fail fast', () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: undefined })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => loadConfig({ ...base, STORAGE_SIGNING_SECRET: '' })).toThrow(
      /STORAGE_SIGNING_SECRET/,
    );
    expect(() => loadConfig({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('reports every problem at once', () => {
    try {
      loadConfig({ NODE_ENV: 'development' });
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).problems.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('validates numeric and boolean values', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, RATE_LIMIT_ENABLED: 'maybe' })).toThrow(
      /RATE_LIMIT_ENABLED/,
    );
    expect(() => loadConfig({ ...base, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => loadConfig({ ...base, NOTIFICATION_CHANNELS: 'in_app,carrier_pigeon' })).toThrow(
      /CARRIER_PIGEON/,
    );
  });

  it('parses CORS origins and trust proxy', () => {
    const cfg = loadConfig({
      ...base,
      CORS_ORIGINS: 'http://a.test/, http://b.test',
      TRUST_PROXY: '1',
    });
    expect(cfg.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
    expect(cfg.trustProxy).toBe(1);
    expect(loadConfig({ ...base, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig(base).trustProxy).toBe(false);
  });

  it('uses cheap password hashing only when asked (tests)', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'test' }).auth.argon2.memoryCost).toBe(1024);
    expect(loadConfig({ ...base, ARGON2_FAST: 'true' }).auth.argon2.memoryCost).toBe(1024);
  });

  describe('production safety rails', () => {
    it('accepts a properly configured production environment', () => {
      const cfg = loadConfig(production);
      expect(cfg.auth.cookieSecure).toBe(true);
      expect(cfg.swagger.enabled).toBe(false);
    });

    it('rejects placeholder secrets', () => {
      expect(() =>
        loadConfig({ ...production, JWT_ACCESS_SECRET: 'CHANGE-ME-' + 'x'.repeat(30) }),
      ).toThrow(/placeholder/);
    });

    it('requires explicit CORS origins and forbids wildcards', () => {
      expect(() => loadConfig({ ...production, CORS_ORIGINS: undefined })).toThrow(/CORS_ORIGINS/);
      expect(() => loadConfig({ ...production, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    });

    it('refuses mock providers unless explicitly allowed', () => {
      expect(() =>
        loadConfig({ ...production, ALLOW_MOCK_PROVIDERS_IN_PRODUCTION: 'false' }),
      ).toThrow(/Mock payment/);
    });

    it('rejects SameSite=None without Secure cookies', () => {
      expect(() =>
        loadConfig({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' }),
      ).toThrow(/COOKIE_SECURE/);
    });
  });
});
