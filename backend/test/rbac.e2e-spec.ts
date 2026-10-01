import { Role } from '@hardware-delivery/shared';
import {
  API,
  bearer,
  createAdmin,
  createUserWithRoles,
  registerCustomer,
} from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('Role-based access control (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  const adminOnly = [
    ['GET', '/admin/settings'],
    ['PATCH', '/admin/settings'],
    ['GET', '/admin/audit-logs'],
  ] as const;

  it.each(adminOnly)('%s %s requires authentication', async (method, path) => {
    const res = await ctx.http[method.toLowerCase() as 'get' | 'patch'](`${API}${path}`).send({});
    expect(res.status).toBe(401);
  });

  it.each(adminOnly)(
    '%s %s is forbidden for customers, stores and drivers',
    async (method, path) => {
      const customer = await registerCustomer(ctx);
      const store = await createUserWithRoles(ctx, [Role.STORE]);
      const driver = await createUserWithRoles(ctx, [Role.DRIVER]);
      for (const account of [customer, store, driver]) {
        const res = await ctx.http[method.toLowerCase() as 'get' | 'patch'](`${API}${path}`)
          .set(bearer(account.token))
          .send({ settings: { 'fees.serviceFeePercent': 5 } });
        expect(res.status).toBe(403);
      }
    },
  );

  it('allows administrators', async () => {
    const admin = await createAdmin(ctx);
    await ctx.http.get(`${API}/admin/settings`).set(bearer(admin.token)).expect(200);
    await ctx.http.get(`${API}/admin/audit-logs`).set(bearer(admin.token)).expect(200);
  });

  it('honours multiple roles on one account', async () => {
    const both = await createUserWithRoles(ctx, [Role.CUSTOMER, Role.ADMIN]);
    await ctx.http.get(`${API}/admin/settings`).set(bearer(both.token)).expect(200);
    const me = await ctx.http.get(`${API}/auth/me`).set(bearer(both.token)).expect(200);
    expect(me.body.roles.sort()).toEqual([Role.ADMIN, Role.CUSTOMER]);
  });

  it('keeps public endpoints public', async () => {
    await ctx.http.get(`${API}/health`).expect(200);
    const res = await ctx.http.get(`${API}/settings/public`).expect(200);
    expect(res.body).toHaveProperty(['general.platformName']);
    // …and does not expose sensitive configuration
    expect(
      Object.keys(res.body).some((k) => k.startsWith('fees.') || k.startsWith('commission.')),
    ).toBe(false);
  });
});
