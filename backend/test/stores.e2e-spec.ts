import { Role, StoreStaffRole } from '@hardware-delivery/shared';
import {
  API,
  bearer,
  createAdmin,
  createCategory,
  createListing,
  createProduct,
  createStore,
  createUserWithRoles,
  registerCustomer,
  STRONG_PASSWORD,
  uniqueEmail,
  unique,
} from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('Stores, staff and tenant isolation (e2e)', () => {
  let ctx: TestContext;
  let admin: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = (await createAdmin(ctx)).token;
  });
  afterAll(() => ctx.close());

  const storePayload = (overrides: Record<string, unknown> = {}) => ({
    name: `Store ${unique('n')}`,
    streetAddress: '1 Test Street',
    city: 'Giyani',
    province: 'Limpopo',
    latitude: -23.3028,
    longitude: 30.7191,
    ...overrides,
  });

  describe('admin store management', () => {
    it('creates a store with an owner and generates a one-time temporary password when none is given', async () => {
      const ownerEmail = uniqueEmail('owner');
      const res = await ctx.http
        .post(`${API}/admin/stores`)
        .set(bearer(admin))
        .send(storePayload({ owner: { email: ownerEmail, firstName: 'Zodwa', lastName: 'Nkosi' } }))
        .expect(201);
      expect(res.body.store).toMatchObject({
        status: 'APPROVED',
        isActive: true,
        staffCount: 1,
        listingCount: 0,
      });
      const { temporaryPassword } = res.body.ownerCredentials;
      expect(temporaryPassword).toHaveLength(14);
      // the temporary password really works, and the owner lands in the STORE role
      const login = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: ownerEmail, password: temporaryPassword })
        .expect(200);
      expect(login.body.user.roles).toEqual(['STORE']);
    });

    it('does not return credentials when the admin chose the password, and links existing users instead of duplicating them', async () => {
      const email = uniqueEmail('existing');
      const customer = await registerCustomer(ctx, { email });
      const res = await ctx.http
        .post(`${API}/admin/stores`)
        .set(bearer(admin))
        .send(
          storePayload({
            owner: { email, firstName: 'X', lastName: 'Y', password: STRONG_PASSWORD },
          }),
        )
        .expect(201);
      expect(res.body.ownerCredentials).toBeUndefined();
      const me = await ctx.http.get(`${API}/auth/me`).set(bearer(customer.token)).expect(200);
      expect(me.body.roles.sort()).toEqual(['CUSTOMER', 'STORE']);
    });

    it('generates unique slugs for stores with the same name', async () => {
      const name = `Twin ${unique('t')}`;
      const a = await createStore(ctx, admin, { name });
      const b = await createStore(ctx, admin, { name });
      expect(a.slug).not.toBe(b.slug);
      expect(b.slug.startsWith(a.slug)).toBe(true);
    });

    it.each([
      ['unknown province', { province: 'Narnia' }],
      ['latitude out of range', { latitude: 123 }],
      ['missing street', { streetAddress: '' }],
      ['bad postal code', { postalCode: 'ABCD' }],
      ['commission above 50%', { commissionPercent: 80 }],
      [
        'hours with closing before opening',
        { operatingHours: { mon: { closed: false, open: '17:00', close: '08:00' } } },
      ],
      [
        'owner with invalid email',
        { owner: { email: 'not-an-email', firstName: 'A', lastName: 'B' } },
      ],
      [
        'owner with weak password',
        { owner: { email: uniqueEmail(), firstName: 'A', lastName: 'B', password: 'weak' } },
      ],
    ])('rejects %s', async (_label, patch) => {
      await ctx.http
        .post(`${API}/admin/stores`)
        .set(bearer(admin))
        .send(storePayload(patch))
        .expect(400);
    });

    it('requires a reason to reject a store and records the decision', async () => {
      const store = await createStore(ctx, admin);
      await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/status`)
        .set(bearer(admin))
        .send({ status: 'REJECTED' })
        .expect(400);
      const rejected = await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/status`)
        .set(bearer(admin))
        .send({ status: 'REJECTED', reason: 'Invalid address' })
        .expect(200);
      expect(rejected.body).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Invalid address',
      });
      const approved = await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/status`)
        .set(bearer(admin))
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(approved.body).toMatchObject({ status: 'APPROVED', rejectionReason: null });
      expect(approved.body.approvedAt).toBeTruthy();

      const audit = await ctx.http
        .get(`${API}/admin/audit-logs`)
        .query({ entityId: store.storeId })
        .set(bearer(admin))
        .expect(200);
      expect(audit.body.data.map((a: { action: string }) => a.action)).toEqual(
        expect.arrayContaining(['store.rejected', 'store.approved', 'store.create']),
      );
    });

    it('updates details and moves the pin (location is stored as PostGIS geography)', async () => {
      const store = await createStore(ctx, admin);
      const res = await ctx.http
        .patch(`${API}/admin/stores/${store.storeId}`)
        .set(bearer(admin))
        .send({
          city: 'Thohoyandou',
          latitude: -22.9456,
          longitude: 30.4849,
          commissionPercent: 7.5,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        city: 'Thohoyandou',
        latitude: -22.9456,
        longitude: 30.4849,
        commissionPercent: 7.5,
      });
      const [row] = await ctx.dataSource.query(
        'SELECT ST_AsText(location::geometry) AS wkt FROM hardware_stores WHERE id = $1',
        [store.storeId],
      );
      expect(row.wkt).toBe('POINT(30.4849 -22.9456)'); // x = longitude, y = latitude
    });

    it('lists stores with server-side filters and pagination', async () => {
      const tag = unique('flt').replace(/-/g, '');
      const a = await createStore(ctx, admin, { name: `${tag} Alpha` });
      await createStore(ctx, admin, { name: `${tag} Beta` });
      await ctx.http
        .post(`${API}/admin/stores/${a.storeId}/active`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      const all = await ctx.http
        .get(`${API}/admin/stores`)
        .query({ search: tag })
        .set(bearer(admin))
        .expect(200);
      expect(all.body.meta.total).toBe(2);
      const inactive = await ctx.http
        .get(`${API}/admin/stores`)
        .query({ search: tag, isActive: false })
        .set(bearer(admin))
        .expect(200);
      expect(inactive.body.data.map((s: { id: string }) => s.id)).toEqual([a.storeId]);
      const paged = await ctx.http
        .get(`${API}/admin/stores`)
        .query({ search: tag, limit: 1, page: 2 })
        .set(bearer(admin))
        .expect(200);
      expect(paged.body.data).toHaveLength(1);
      expect(paged.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
    });

    it('is restricted to administrators', async () => {
      const store = await createStore(ctx, admin);
      const driver = await createUserWithRoles(ctx, [Role.DRIVER]);
      for (const token of [store.owner.token, driver.token]) {
        await ctx.http.get(`${API}/admin/stores`).set(bearer(token)).expect(403);
        await ctx.http
          .post(`${API}/admin/stores`)
          .set(bearer(token))
          .send(storePayload())
          .expect(403);
        await ctx.http
          .post(`${API}/admin/stores/${store.storeId}/status`)
          .set(bearer(token))
          .send({ status: 'APPROVED' })
          .expect(403);
      }
    });
  });

  describe('public discovery (PostGIS)', () => {
    it('ranks stores by distance from the customer and reports kilometres', async () => {
      const tag = unique('geo').replace(/-/g, '');
      await createStore(ctx, admin, {
        name: `${tag} Polokwane`,
        latitude: -23.9045,
        longitude: 29.4689,
        city: 'Polokwane',
      });
      await createStore(ctx, admin, {
        name: `${tag} Malamulele`,
        latitude: -23.0167,
        longitude: 30.6781,
      });
      await createStore(ctx, admin, {
        name: `${tag} Giyani`,
        latitude: -23.3028,
        longitude: 30.7191,
        city: 'Giyani',
      });
      // customer stands in Malamulele
      const res = await ctx.http
        .get(`${API}/stores`)
        .query({ search: tag, lat: -23.0167, lng: 30.6781 })
        .expect(200);
      expect(res.body.data.map((s: { name: string }) => s.name.replace(`${tag} `, ''))).toEqual([
        'Malamulele',
        'Giyani',
        'Polokwane',
      ]);
      const km = res.body.data.map((s: { distanceKm: number }) => s.distanceKm);
      expect(km[0]).toBeLessThan(1);
      expect(km[1]).toBeGreaterThan(30);
      expect(km[1]).toBeLessThan(40);
      expect(km[2]).toBeGreaterThan(150);
      expect(km[2]).toBeLessThan(170);

      const nearby = await ctx.http
        .get(`${API}/stores`)
        .query({ search: tag, lat: -23.0167, lng: 30.6781, radiusKm: 60 })
        .expect(200);
      expect(nearby.body.data.map((s: { name: string }) => s.name)).toEqual([
        `${tag} Malamulele`,
        `${tag} Giyani`,
      ]);
      // without a location there is no distance, sorted by name
      const noPoint = await ctx.http.get(`${API}/stores`).query({ search: tag }).expect(200);
      expect(noPoint.body.data[0].distanceKm).toBeNull();
    });

    it('finds stores that sell a category, and exposes store details by id or slug', async () => {
      const cat = await createCategory(ctx, admin);
      const sub = await createCategory(ctx, admin, unique('Sub'), cat.id);
      const seller = await createStore(ctx, admin);
      const other = await createStore(ctx, admin);
      const product = await createProduct(ctx, admin, sub.id);
      await createListing(ctx, admin, seller.storeId, product.id);
      const byCategory = await ctx.http
        .get(`${API}/stores`)
        .query({ categoryId: cat.id })
        .expect(200);
      expect(byCategory.body.data.map((s: { id: string }) => s.id)).toEqual([seller.storeId]);
      expect(byCategory.body.data.some((s: { id: string }) => s.id === other.storeId)).toBe(false);

      const bySlug = await ctx.http.get(`${API}/stores/${seller.slug}`).expect(200);
      const byId = await ctx.http.get(`${API}/stores/${seller.storeId}`).expect(200);
      expect(bySlug.body.id).toBe(byId.body.id);
      expect(bySlug.body.categories).toEqual([
        expect.objectContaining({ id: sub.id, listingCount: 1 }),
      ]);
      expect(bySlug.body.operatingHours.mon).toBeDefined();
      await ctx.http.get(`${API}/stores/does-not-exist`).expect(404);
    });
  });

  describe('store portal', () => {
    it('shows my store and role, and lets managers update only what stores may change', async () => {
      const store = await createStore(ctx, admin);
      const me = await ctx.http.get(`${API}/store/me`).set(bearer(store.owner.token)).expect(200);
      expect(me.body).toMatchObject({ id: store.storeId, myRole: 'OWNER' });

      const hours = {
        ...me.body.operatingHours,
        sat: { closed: true, open: '08:00', close: '13:00' },
      };
      const patched = await ctx.http
        .patch(`${API}/store/me`)
        .set(bearer(store.owner.token))
        .send({
          description: 'Everything for builders',
          acceptingOrders: false,
          operatingHours: hours,
        })
        .expect(200);
      expect(patched.body).toMatchObject({
        description: 'Everything for builders',
        acceptingOrders: false,
      });
      expect(patched.body.operatingHours.sat.closed).toBe(true);

      // stores cannot move their own pin, change commission, or approve themselves
      for (const forbidden of [
        { latitude: 1 },
        { commissionPercent: 0 },
        { status: 'APPROVED' },
        { isActive: true },
        { name: 'Renamed' },
      ]) {
        await ctx.http
          .patch(`${API}/store/me`)
          .set(bearer(store.owner.token))
          .send(forbidden)
          .expect(400);
      }
    });

    it("isolates tenants: a store can never see or change another store's data", async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const a = await createStore(ctx, admin);
      const b = await createStore(ctx, admin);
      const listingB = await createListing(ctx, admin, b.storeId, product.id, {
        price: 99,
        stockQuantity: 10,
      });

      // A cannot read, edit, delete or restock B's listing – it simply does not exist for A
      await ctx.http
        .get(`${API}/store/listings/${listingB.id}`)
        .set(bearer(a.owner.token))
        .expect(404);
      await ctx.http
        .patch(`${API}/store/listings/${listingB.id}`)
        .set(bearer(a.owner.token))
        .send({ price: 1 })
        .expect(404);
      await ctx.http
        .delete(`${API}/store/listings/${listingB.id}`)
        .set(bearer(a.owner.token))
        .expect(404);
      await ctx.http
        .post(`${API}/store/listings/${listingB.id}/stock`)
        .set(bearer(a.owner.token))
        .send({ mode: 'SET', quantity: 0, reason: 'CORRECTION' })
        .expect(404);
      // A's own list never includes B's
      const mine = await ctx.http
        .get(`${API}/store/listings`)
        .set(bearer(a.owner.token))
        .expect(200);
      expect(mine.body.data).toHaveLength(0);
      // claiming to act as B via the header is refused
      await ctx.http
        .get(`${API}/store/me`)
        .set(bearer(a.owner.token))
        .set('X-Store-Id', b.storeId)
        .expect(403);
      // B's listing is untouched
      const check = await ctx.http
        .get(`${API}/admin/listings/${listingB.id}`)
        .set(bearer(admin))
        .expect(200);
      expect(check.body).toMatchObject({ price: 99, stockQuantity: 10 });
    });

    it('rejects users that are not store staff', async () => {
      const customer = await registerCustomer(ctx);
      await ctx.http.get(`${API}/store/me`).set(bearer(customer.token)).expect(403);
      await ctx.http.get(`${API}/store/me`).expect(401);
      const orphan = await createUserWithRoles(ctx, [Role.STORE]); // STORE role but no membership
      const res = await ctx.http.get(`${API}/store/me`).set(bearer(orphan.token)).expect(403);
      expect(res.body.message).toMatch(/not linked to a store/i);
    });

    it('lets users that belong to several stores choose one with X-Store-Id', async () => {
      const s1 = await createStore(ctx, admin);
      const s2 = await createStore(ctx, admin);
      await ctx.http
        .post(`${API}/admin/stores/${s2.storeId}/staff`)
        .set(bearer(admin))
        .send({ email: s1.owner.email, firstName: 'x', lastName: 'y', role: 'MANAGER' })
        .expect(201);
      const defaultStore = await ctx.http
        .get(`${API}/store/me`)
        .set(bearer(s1.owner.token))
        .expect(200);
      expect(defaultStore.body).toMatchObject({ id: s1.storeId, myRole: 'OWNER' }); // OWNER memberships take priority
      const chosen = await ctx.http
        .get(`${API}/store/me`)
        .set(bearer(s1.owner.token))
        .set('X-Store-Id', s2.storeId)
        .expect(200);
      expect(chosen.body).toMatchObject({ id: s2.storeId, myRole: 'MANAGER' });
    });
  });

  describe('staff roles', () => {
    it('enforces OWNER / MANAGER / STAFF permissions', async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const store = await createStore(ctx, admin);
      const listing = await createListing(ctx, admin, store.storeId, product.id, {
        price: 100,
        stockQuantity: 10,
      });

      const add = async (role: StoreStaffRole) => {
        const email = uniqueEmail(role.toLowerCase());
        await ctx.http
          .post(`${API}/store/staff`)
          .set(bearer(store.owner.token))
          .send({ email, firstName: role, lastName: 'Person', password: STRONG_PASSWORD, role })
          .expect(201);
        const login = await ctx.http
          .post(`${API}/auth/login`)
          .send({ email, password: STRONG_PASSWORD })
          .expect(200);
        return login.body.accessToken as string;
      };
      const manager = await add(StoreStaffRole.MANAGER);
      const staff = await add(StoreStaffRole.STAFF);

      // everyone can read listings and adjust stock
      for (const token of [store.owner.token, manager, staff]) {
        await ctx.http.get(`${API}/store/listings`).set(bearer(token)).expect(200);
        await ctx.http
          .post(`${API}/store/listings/${listing.id}/stock`)
          .set(bearer(token))
          .send({ mode: 'ADD', quantity: 1, reason: 'RESTOCK' })
          .expect(200);
      }
      // only owner + manager change prices
      await ctx.http
        .patch(`${API}/store/listings/${listing.id}`)
        .set(bearer(staff))
        .send({ price: 1 })
        .expect(403);
      await ctx.http
        .patch(`${API}/store/listings/${listing.id}`)
        .set(bearer(manager))
        .send({ price: 120 })
        .expect(200);
      await ctx.http
        .patch(`${API}/store/me`)
        .set(bearer(staff))
        .send({ description: 'x' })
        .expect(403);
      // only the owner manages staff
      await ctx.http
        .post(`${API}/store/staff`)
        .set(bearer(manager))
        .send({ email: uniqueEmail(), firstName: 'a', lastName: 'b', role: 'STAFF' })
        .expect(403);
      await ctx.http.get(`${API}/store/staff`).set(bearer(staff)).expect(403);
      const roster = await ctx.http.get(`${API}/store/staff`).set(bearer(manager)).expect(200);
      expect(roster.body.meta.total).toBe(3);
    });

    it('never leaves a store without an active owner', async () => {
      const store = await createStore(ctx, admin);
      const roster = (
        await ctx.http.get(`${API}/store/staff`).set(bearer(store.owner.token)).expect(200)
      ).body.data;
      const ownerRow = roster.find((r: { email: string }) => r.email === store.owner.email);
      await ctx.http
        .patch(`${API}/store/staff/${ownerRow.id}`)
        .set(bearer(store.owner.token))
        .send({ role: 'MANAGER' })
        .expect(409);
      await ctx.http
        .patch(`${API}/store/staff/${ownerRow.id}`)
        .set(bearer(store.owner.token))
        .send({ isActive: false })
        .expect(409);
      await ctx.http
        .delete(`${API}/store/staff/${ownerRow.id}`)
        .set(bearer(store.owner.token))
        .expect(409);
    });

    it('rejects adding the same person twice and removes access when staff are deactivated', async () => {
      const store = await createStore(ctx, admin);
      const email = uniqueEmail('twice');
      const body = {
        email,
        firstName: 'T',
        lastName: 'W',
        password: STRONG_PASSWORD,
        role: 'STAFF',
      };
      const created = await ctx.http
        .post(`${API}/store/staff`)
        .set(bearer(store.owner.token))
        .send(body)
        .expect(201);
      await ctx.http
        .post(`${API}/store/staff`)
        .set(bearer(store.owner.token))
        .send(body)
        .expect(409);
      const token = (
        await ctx.http
          .post(`${API}/auth/login`)
          .send({ email, password: STRONG_PASSWORD })
          .expect(200)
      ).body.accessToken;
      await ctx.http.get(`${API}/store/me`).set(bearer(token)).expect(200);
      await ctx.http
        .patch(`${API}/store/staff/${created.body.staff.id}`)
        .set(bearer(store.owner.token))
        .send({ isActive: false })
        .expect(200);
      await ctx.http.get(`${API}/store/me`).set(bearer(token)).expect(403);
    });
  });
});
