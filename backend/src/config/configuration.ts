/**
 * Typed application configuration, built from environment variables.
 *
 * - Nothing secret has a default: missing/short secrets fail fast at boot with a clear message.
 * - `loadConfig` is pure (takes an env map) so it is trivially unit-testable.
 */

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  env: NodeEnv;
  isProduction: boolean;
  port: number;
  /** Public origin of the API (used to build absolute links, e.g. file URLs and webhooks). */
  appUrl: string;
  /** Public origin of the web app (used for payment return URLs and notification links). */
  frontendUrl: string;
  corsOrigins: string[];
  trustProxy: boolean | number | string;
  database: {
    url: string;
    poolMax: number;
    ssl: boolean;
    logging: boolean;
    runMigrationsOnStart: boolean;
  };
  auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    refreshCookieName: string;
    cookieSecure: boolean;
    cookieSameSite: 'strict' | 'lax' | 'none';
    refreshReuseGraceSeconds: number;
    maxFailedLogins: number;
    lockoutMinutes: number;
    argon2: { memoryCost: number; timeCost: number; parallelism: number };
  };
  rateLimit: { enabled: boolean; ttlMs: number; limit: number; authLimit: number };
  swagger: { enabled: boolean };
  providers: {
    payment: string;
    maps: string;
    storage: string;
    notificationChannels: string[];
    allowMockInProduction: boolean;
  };
  storage: { uploadDir: string; signingSecret: string; signedUrlTtlSeconds: number };
  scheduler: { enabled: boolean };
  mock: { paymentWebhookSecret: string };
}

type Env = Record<string, string | undefined>;

const PLACEHOLDER_PATTERN = /change[-_ ]?me|replace[-_ ]?me|your[-_ ]secret|example/i;

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'Copy .env.example to .env and review the values.',
    );
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Env = process.env): AppConfig {
  const problems: string[] = [];

  const str = (key: string, fallback?: string): string => {
    const v = env[key]?.trim();
    if (v) return v;
    if (fallback !== undefined) return fallback;
    problems.push(`${key} is required`);
    return '';
  };
  const int = (key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
    const raw = env[key]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      problems.push(`${key} must be an integer between ${min} and ${max} (got "${raw}")`);
      return fallback;
    }
    return n;
  };
  const bool = (key: string, fallback: boolean): boolean => {
    const raw = env[key]?.trim().toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'off'].includes(raw)) return false;
    problems.push(`${key} must be true or false (got "${raw}")`);
    return fallback;
  };
  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = (env[key]?.trim() as T | undefined) ?? fallback;
    if (!allowed.includes(raw)) {
      problems.push(`${key} must be one of: ${allowed.join(', ')} (got "${raw}")`);
      return fallback;
    }
    return raw;
  };
  const secret = (key: string, minLength = 32): string => {
    const v = env[key]?.trim() ?? '';
    if (v.length < minLength)
      problems.push(`${key} is required and must be at least ${minLength} characters`);
    return v;
  };

  const nodeEnv = oneOf<NodeEnv>('NODE_ENV', ['development', 'test', 'production'], 'development');
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const port = int('PORT', 3000, 1, 65535);
  const appUrl = str('APP_URL', `http://localhost:${port}`).replace(/\/$/, '');
  const frontendUrl = str('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '');
  const corsOrigins = (env.CORS_ORIGINS ?? frontendUrl)
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const trustProxyRaw = env.TRUST_PROXY?.trim().toLowerCase();
  let trustProxy: AppConfig['trustProxy'] = false;
  if (trustProxyRaw === 'true') trustProxy = true;
  else if (trustProxyRaw && /^\d+$/.test(trustProxyRaw)) trustProxy = Number(trustProxyRaw);
  else if (trustProxyRaw && trustProxyRaw !== 'false') trustProxy = env.TRUST_PROXY!.trim();

  const databaseUrl = str('DATABASE_URL');

  const accessSecret = secret('JWT_ACCESS_SECRET');
  const signingSecret = secret('STORAGE_SIGNING_SECRET');

  const cookieSameSite = oneOf('COOKIE_SAMESITE', ['strict', 'lax', 'none'] as const, 'strict');
  const cookieSecure = bool('COOKIE_SECURE', isProduction);
  if (cookieSameSite === 'none' && !cookieSecure) {
    problems.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }

  const providers = {
    payment: oneOf('PAYMENT_PROVIDER', ['mock'] as const, 'mock') as string,
    maps: oneOf('MAPS_PROVIDER', ['mock'] as const, 'mock') as string,
    storage: oneOf('STORAGE_PROVIDER', ['local'] as const, 'local') as string,
    notificationChannels: (env.NOTIFICATION_CHANNELS ?? 'in_app')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    allowMockInProduction: bool('ALLOW_MOCK_PROVIDERS_IN_PRODUCTION', false),
  };
  for (const ch of providers.notificationChannels) {
    if (!['IN_APP', 'EMAIL', 'SMS', 'PUSH'].includes(ch)) {
      problems.push(
        `NOTIFICATION_CHANNELS contains unknown channel "${ch}" (use in_app,email,sms,push)`,
      );
    }
  }

  if (isProduction) {
    if (PLACEHOLDER_PATTERN.test(accessSecret))
      problems.push('JWT_ACCESS_SECRET still looks like a placeholder');
    if (PLACEHOLDER_PATTERN.test(signingSecret))
      problems.push('STORAGE_SIGNING_SECRET still looks like a placeholder');
    if (!env.CORS_ORIGINS?.trim())
      problems.push('CORS_ORIGINS must be set explicitly in production');
    if (corsOrigins.includes('*')) problems.push('CORS_ORIGINS must not contain "*" in production');
    const mockInUse = [providers.payment, providers.maps].some((p) => p === 'mock');
    if (mockInUse && !providers.allowMockInProduction) {
      problems.push(
        'Mock payment/maps providers are active in production. Configure real providers, or set ' +
          'ALLOW_MOCK_PROVIDERS_IN_PRODUCTION=true for a staging/demo deployment.',
      );
    }
  }

  const argonFast = bool('ARGON2_FAST', isTest);
  const rateLimitWindow = int('RATE_LIMIT_TTL_SECONDS', 60, 1, 3600);

  // Read every remaining value BEFORE checking `problems`, so that all mistakes are reported at once.
  const config: AppConfig = {
    env: nodeEnv,
    isProduction,
    port,
    appUrl,
    frontendUrl,
    corsOrigins,
    trustProxy,
    database: {
      url: databaseUrl,
      poolMax: int('DATABASE_POOL_MAX', 10, 1, 200),
      ssl: bool('DATABASE_SSL', false),
      logging: bool('DATABASE_LOGGING', false),
      runMigrationsOnStart: bool('RUN_MIGRATIONS_ON_START', false),
    },
    auth: {
      accessSecret,
      accessTtlSeconds: int('JWT_ACCESS_TTL_SECONDS', 900, 60, 86400),
      refreshTtlSeconds: int('JWT_REFRESH_TTL_DAYS', 30, 1, 365) * 86400,
      refreshCookieName: str('REFRESH_COOKIE_NAME', 'hd_refresh'),
      cookieSecure,
      cookieSameSite,
      refreshReuseGraceSeconds: int('REFRESH_REUSE_GRACE_SECONDS', 10, 0, 120),
      maxFailedLogins: int('AUTH_MAX_FAILED_LOGINS', 5, 1, 100),
      lockoutMinutes: int('AUTH_LOCKOUT_MINUTES', 15, 1, 1440),
      argon2: argonFast
        ? { memoryCost: 1024, timeCost: 1, parallelism: 1 }
        : { memoryCost: 19456, timeCost: 2, parallelism: 1 }, // OWASP minimum for Argon2id
    },
    rateLimit: {
      enabled: bool('RATE_LIMIT_ENABLED', true),
      ttlMs: rateLimitWindow * 1000,
      limit: int('RATE_LIMIT_MAX', 300, 1, 100000),
      authLimit: int('RATE_LIMIT_AUTH_MAX', 10, 1, 1000),
    },
    swagger: { enabled: bool('SWAGGER_ENABLED', !isProduction) },
    providers,
    storage: {
      uploadDir: str('UPLOAD_DIR', './uploads'),
      signingSecret,
      signedUrlTtlSeconds: int('STORAGE_SIGNED_URL_TTL_SECONDS', 600, 30, 86400),
    },
    scheduler: { enabled: bool('SCHEDULER_ENABLED', !isTest) },
    mock: {
      paymentWebhookSecret: str('MOCK_PAYMENT_WEBHOOK_SECRET', 'mock-webhook-secret-dev-only'),
    },
  };

  if (problems.length) throw new ConfigError(problems);
  return config;
}
