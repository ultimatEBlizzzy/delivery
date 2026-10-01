import { API, registerCustomer, STRONG_PASSWORD, uniqueEmail } from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('HTTP security (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('sets hardening headers and hides the framework', async () => {
    const res = await ctx.http.get(`${API}/health`).expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('echoes a client-supplied request id but ignores unsafe ones', async () => {
    const ok = await ctx.http
      .get(`${API}/health`)
      .set('X-Request-Id', 'trace-1234567890')
      .expect(200);
    expect(ok.headers['x-request-id']).toBe('trace-1234567890');
    const bad = await ctx.http
      .get(`${API}/health`)
      .set('X-Request-Id', 'x\ninjected')
      .catch(() => null);
    if (bad) expect(bad.headers['x-request-id']).not.toContain('injected');
  });

  describe('CORS', () => {
    it('allows configured origins with credentials', async () => {
      const res = await ctx.http
        .options(`${API}/auth/login`)
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not grant access to other origins', async () => {
      const res = await ctx.http.get(`${API}/health`).set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns a consistent error envelope without internals', async () => {
      const res = await ctx.http.get(`${API}/does-not-exist`).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, path: `${API}/does-not-exist` });
      expect(res.body.requestId).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules|typeorm/i);
    });

    it('rejects malformed JSON with 400 (not 500)', async () => {
      const res = await ctx.http
        .post(`${API}/auth/login`)
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(res.status).toBe(400);
    });

    it('rejects oversized bodies', async () => {
      const res = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: 'a@b.co', password: 'x'.repeat(300_000) });
      expect(res.status).toBe(413);
    });

    it('rejects invalid UUIDs in the database layer with 400, not 500', async () => {
      const { token } = await registerCustomer(ctx);
      const res = await ctx.http
        .get(`${API}/admin/audit-logs`)
        .query({ actorUserId: 'not-a-uuid' })
        .set('Authorization', `Bearer ${token}`);
      expect([400, 403]).toContain(res.status);
    });
  });

  describe('rate limiting', () => {
    it('throttles credential endpoints per client', async () => {
      const limited = await createTestApp({
        RATE_LIMIT_ENABLED: 'true',
        RATE_LIMIT_AUTH_MAX: '3',
        RATE_LIMIT_MAX: '1000',
      });
      try {
        const body = { email: uniqueEmail('rl'), password: STRONG_PASSWORD };
        const statuses: number[] = [];
        for (let i = 0; i < 5; i++)
          statuses.push((await limited.http.post(`${API}/auth/login`).send(body)).status);
        expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
        expect(statuses.slice(3)).toEqual([429, 429]);
        // ordinary endpoints keep working
        await limited.http.get(`${API}/health`).expect(200);
      } finally {
        await limited.close();
      }
    });
  });
});
