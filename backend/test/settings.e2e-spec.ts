import { API, bearer, createAdmin } from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('Platform settings (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;
  beforeAll(async () => {
    ctx = await createTestApp();
    adminToken = (await createAdmin(ctx)).token;
  });
  afterAll(() => ctx.close());

  it('lists every setting with metadata and defaults', async () => {
    const res = await ctx.http.get(`${API}/admin/settings`).set(bearer(adminToken)).expect(200);
    const fee = res.body.find((s: { key: string }) => s.key === 'fees.serviceFeePercent');
    expect(fee).toMatchObject({ type: 'number', min: 0, max: 30, unit: '%' });
    expect(res.body.length).toBeGreaterThan(10);
  });

  it('updates validated values, persists them and writes an audit entry', async () => {
    const res = await ctx.http
      .patch(`${API}/admin/settings`)
      .set(bearer(adminToken))
      .send({ settings: { 'fees.serviceFeePercent': 4.5, 'orders.enforceStoreHours': true } })
      .expect(200);
    const updated = Object.fromEntries(
      res.body.map((s: { key: string; value: unknown }) => [s.key, s.value]),
    );
    expect(updated['fees.serviceFeePercent']).toBe(4.5);
    expect(updated['orders.enforceStoreHours']).toBe(true);

    const audit = await ctx.http
      .get(`${API}/admin/audit-logs`)
      .query({ action: 'settings.update' })
      .set(bearer(adminToken))
      .expect(200);
    expect(audit.body.data[0]).toMatchObject({
      action: 'settings.update',
      after: { 'fees.serviceFeePercent': 4.5 },
    });
    expect(audit.body.data[0].actorEmail).toBeTruthy();
  });

  it.each([
    ['out-of-range number', { 'fees.serviceFeePercent': 99 }],
    ['wrong type', { 'fees.serviceFeePercent': 'free' }],
    ['unknown key', { 'made.up': 1 }],
    ['bad boolean', { 'orders.enforceStoreHours': 'yes' }],
    [
      'invalid peak window',
      { 'pricing.peakWindows': [{ days: [9], start: '07:00', end: '09:00' }] },
    ],
    ['min fee above max fee', { 'fees.serviceFeeMin': 100, 'fees.serviceFeeMax': 10 }],
  ])('rejects %s', async (_label, settings) => {
    await ctx.http
      .patch(`${API}/admin/settings`)
      .set(bearer(adminToken))
      .send({ settings })
      .expect(400);
  });

  it('rejects an empty update', async () => {
    await ctx.http
      .patch(`${API}/admin/settings`)
      .set(bearer(adminToken))
      .send({ settings: {} })
      .expect(400);
  });
});
