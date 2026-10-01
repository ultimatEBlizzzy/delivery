import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Environment for the Nest app under test. These are test fixtures, not real secrets.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret-0123456789abcdefghij';
process.env.STORAGE_SIGNING_SECRET = 'e2e-test-storage-secret-0123456789abcdefghi';
process.env.MOCK_PAYMENT_WEBHOOK_SECRET = 'e2e-test-webhook-secret';
process.env.ARGON2_FAST = 'true';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.SCHEDULER_ENABLED = 'false';
process.env.SWAGGER_ENABLED = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.REFRESH_REUSE_GRACE_SECONDS = '0';
process.env.UPLOAD_DIR ??= mkdtempSync(join(tmpdir(), 'hd-e2e-uploads-'));
// DATABASE_URL is injected by global-setup (test database).
