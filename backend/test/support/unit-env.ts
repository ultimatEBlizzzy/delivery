// Deterministic environment for unit tests (these are test fixtures, not real secrets).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'unit-test-access-secret-0123456789abcdef';
process.env.STORAGE_SIGNING_SECRET ??= 'unit-test-storage-secret-0123456789abcd';
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused';
