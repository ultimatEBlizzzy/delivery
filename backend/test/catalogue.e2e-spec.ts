import { Role } from '@hardware-delivery/shared';
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
  unique,
} from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('Catalogue: categories, products, store-specific pricing (e2e)', () => {
  let ctx: TestContext;
  let admin: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = (await createAdmin(ctx)).token;
  });
  afterAll(() => ctx.close());

  describe('categories', () => {
    it('builds a hierarchy and rolls listing counts up to parents (public tree)', async () => {
      const parent = await createCategory(ctx, admin, unique('Plumbing'));
      const child = await createCategory(ctx, admin, unique('Pipes'), parent.id);
      const store = await createStore(ctx, admin);
      const product = await createProduct(ctx, admin, child.id);
      await createListing(ctx, admin, store.storeId, product.id);

      const tree = (await ctx.http.get(`${API}/categories`).expect(200)).body as Array<{
        id: string;
        listingCount: number;
        children: Array<{ id: string; listingCount: number }>;
      }>;
      const root = tree.find((c) => c.id === parent.id)!;
      expect(root.listingCount).toBe(1);
      expect(root.children.find((c) => c.id === child.id)!.listingCount).toBe(1);
    });

    it('rejects cycles, self-parenting and deleting categories that are in use', async () => {
      const a = await createCategory(ctx, admin);
      const b = await createCategory(ctx, admin, unique('Child'), a.id);
      await ctx.http
        .patch(`${API}/admin/categories/${a.id}`)
        .set(bearer(admin))
        .send({ parentId: a.id })
        .expect(400);
      await ctx.http
        .patch(`${API}/admin/categories/${a.id}`)
        .set(bearer(admin))
        .send({ parentId: b.id })
        .expect(400); // would create a cycle
      await ctx.http.delete(`${API}/admin/categories/${a.id}`).set(bearer(admin)).expect(409); // has a sub-category

      await createProduct(ctx, admin, b.id);
      await ctx.http.delete(`${API}/admin/categories/${b.id}`).set(bearer(admin)).expect(409); // has products
    });

    it('hides inactive categories (and everything below them) from the public tree', async () => {
      const parent = await createCategory(ctx, admin);
      const child = await createCategory(ctx, admin, unique('Kid'), parent.id);
      await ctx.http
        .patch(`${API}/admin/categories/${parent.id}`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      const pub = (await ctx.http.get(`${API}/categories`)).body as Array<{
        id: string;
        children: Array<{ id: string }>;
      }>;
      expect(pub.some((c) => c.id === parent.id)).toBe(false);
      expect(JSON.stringify(pub)).not.toContain(child.id);
      const adminTree = (
        await ctx.http.get(`${API}/admin/categories`).set(bearer(admin)).expect(200)
      ).body as Array<{ id: string }>;
      expect(adminTree.some((c) => c.id === parent.id)).toBe(true);
    });

    it('only administrators can manage categories', async () => {
      const customer = await registerCustomer(ctx);
      await ctx.http
        .post(`${API}/admin/categories`)
        .set(bearer(customer.token))
        .send({ name: 'Nope' })
        .expect(403);
      await ctx.http.post(`${API}/admin/categories`).send({ name: 'Nope' }).expect(401);
    });
  });

  describe('product creation (global catalogue)', () => {
    let categoryId: string;
    beforeAll(async () => {
      categoryId = (await createCategory(ctx, admin)).id;
    });

    it('creates a product with a normalised SKU, slug and weight/dimensions', async () => {
      const res = await ctx.http
        .post(`${API}/admin/products`)
        .set(bearer(admin))
        .send({
          categoryId,
          name: 'Cement 42.5R 50kg',
          sku: ' cem-42r-' + unique('x'),
          brand: 'PowerCem',
          unit: 'bag',
          packSize: '50 kg bag',
          weightKg: 50,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 10,
        })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Cement 42.5R 50kg',
        unit: 'bag',
        weightKg: 50,
        lengthCm: 60,
        isActive: true,
        createdByStoreId: null,
      });
      expect(res.body.sku).toBe(res.body.sku.toUpperCase());
      expect(res.body.slug).toMatch(/^cement-42-5r-50kg/);
    });

    it.each([
      ['missing name', { name: undefined }],
      ['missing weight', { weightKg: undefined }],
      ['negative weight', { weightKg: -1 }],
      ['unknown unit', { unit: 'bucketload' }],
      ['bad SKU characters', { sku: 'bad sku!' }],
      ['non-uuid category', { categoryId: 'abc' }],
    ])('rejects %s', async (_label, patch) => {
      const body = {
        categoryId,
        name: 'X',
        sku: unique('OK').toUpperCase(),
        unit: 'each',
        weightKg: 1,
        ...patch,
      };
      await ctx.http.post(`${API}/admin/products`).set(bearer(admin)).send(body).expect(400);
    });

    it('rejects an unknown category (404) and a duplicate SKU (409, case-insensitive)', async () => {
      const sku = unique('DUP').toUpperCase();
      await ctx.http
        .post(`${API}/admin/products`)
        .set(bearer(admin))
        .send({
          categoryId: '00000000-0000-4000-8000-000000000000',
          name: 'X',
          sku,
          unit: 'each',
          weightKg: 1,
        })
        .expect(404);
      await createProduct(ctx, admin, categoryId, { sku });
      const dup = await ctx.http
        .post(`${API}/admin/products`)
        .set(bearer(admin))
        .send({ categoryId, name: 'Y', sku: sku.toLowerCase(), unit: 'each', weightKg: 1 })
        .expect(409);
      expect(dup.body.message).toContain(sku);
    });

    it('does not allow customers, stores or drivers to create catalogue products', async () => {
      const store = await createStore(ctx, admin);
      const driver = await createUserWithRoles(ctx, [Role.DRIVER]);
      const customer = await registerCustomer(ctx);
      const body = {
        categoryId,
        name: 'Hack',
        sku: unique('H').toUpperCase(),
        unit: 'each',
        weightKg: 1,
      };
      for (const token of [store.owner.token, driver.token, customer.token]) {
        await ctx.http.post(`${API}/admin/products`).set(bearer(token)).send(body).expect(403);
      }
    });

    it('refuses unknown fields such as a client-chosen id or createdByStoreId', async () => {
      const res = await ctx.http
        .post(`${API}/admin/products`)
        .set(bearer(admin))
        .send({
          categoryId,
          name: 'X',
          sku: unique('Z').toUpperCase(),
          unit: 'each',
          weightKg: 1,
          createdByStoreId: 'abc',
          id: 'abc',
        })
        .expect(400);
      expect(JSON.stringify(res.body.details)).toMatch(/should not exist/);
    });

    it('cannot delete a product that stores list, but can deactivate it (hiding it everywhere)', async () => {
      const store = await createStore(ctx, admin);
      const product = await createProduct(ctx, admin, categoryId);
      await createListing(ctx, admin, store.storeId, product.id);
      await ctx.http.delete(`${API}/admin/products/${product.id}`).set(bearer(admin)).expect(409);
      await ctx.http
        .patch(`${API}/admin/products/${product.id}`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      await ctx.http.get(`${API}/products/${product.id}`).expect(404);
      const search = await ctx.http
        .get(`${API}/products`)
        .query({ storeId: store.storeId })
        .expect(200);
      expect(search.body.data).toHaveLength(0);
    });

    it('lets a store create a missing product, flagged as created by that store', async () => {
      const store = await createStore(ctx, admin);
      const res = await ctx.http
        .post(`${API}/store/catalogue/products`)
        .set(bearer(store.owner.token))
        .send({
          categoryId,
          name: 'Store-made Widget',
          sku: unique('SM').toUpperCase(),
          unit: 'each',
          weightKg: 2,
        })
        .expect(201);
      expect(res.body.createdByStoreId).toBe(store.storeId);
      // the store may edit it while no other store lists it…
      await ctx.http
        .patch(`${API}/store/catalogue/products/${res.body.id}`)
        .set(bearer(store.owner.token))
        .send({ weightKg: 3 })
        .expect(200);
      // …but not once another store lists it
      const other = await createStore(ctx, admin);
      await createListing(ctx, admin, other.storeId, res.body.id);
      await ctx.http
        .patch(`${API}/store/catalogue/products/${res.body.id}`)
        .set(bearer(store.owner.token))
        .send({ weightKg: 4 })
        .expect(403);
      // and never products created by an admin
      const shared = await createProduct(ctx, admin, categoryId);
      await ctx.http
        .patch(`${API}/store/catalogue/products/${shared.id}`)
        .set(bearer(store.owner.token))
        .send({ weightKg: 4 })
        .expect(403);
    });
  });

  describe('store-specific pricing', () => {
    it('lets two stores sell the same product at different prices, stock and limits', async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id, { name: `Cement ${unique('c')}` });
      const storeA = await createStore(ctx, admin);
      const storeB = await createStore(ctx, admin, {
        latitude: -23.9045,
        longitude: 29.4689,
        city: 'Polokwane',
      });
      const a = await createListing(ctx, admin, storeA.storeId, product.id, {
        price: 109.99,
        stockQuantity: 40,
        minimumQuantity: 2,
        maximumQuantity: 20,
      });
      const b = await createListing(ctx, admin, storeB.storeId, product.id, {
        price: 129.5,
        salePrice: 119.5,
        stockQuantity: 7,
      });

      const detail = (await ctx.http.get(`${API}/products/${product.id}`).expect(200)).body;
      expect(detail.offers).toHaveLength(2);
      // cheapest effective price first
      expect(detail.offers.map((o: { id: string }) => o.id)).toEqual([a.id, b.id]);
      const [offerA, offerB] = detail.offers;
      expect(offerA).toMatchObject({
        price: 109.99,
        salePrice: null,
        effectivePrice: 109.99,
        onSale: false,
        stockQuantity: 40,
        minimumQuantity: 2,
        maximumQuantity: 20,
        maxOrderable: 20,
      });
      expect(offerB).toMatchObject({
        price: 129.5,
        salePrice: 119.5,
        effectivePrice: 119.5,
        onSale: true,
        stockQuantity: 7,
        maxOrderable: 7,
      });
      expect(offerA.store.id).toBe(storeA.storeId);
      expect(offerB.store.id).toBe(storeB.storeId);
    });

    it("changing one store's price never affects another store's offer", async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const s1 = await createStore(ctx, admin);
      const s2 = await createStore(ctx, admin);
      const l1 = await createListing(ctx, admin, s1.storeId, product.id, { price: 50 });
      const l2 = await createListing(ctx, admin, s2.storeId, product.id, { price: 60 });
      await ctx.http
        .patch(`${API}/store/listings/${l1.id}`)
        .set(bearer(s1.owner.token))
        .send({ price: 75.25 })
        .expect(200);
      const after = (
        await ctx.http.get(`${API}/admin/listings/${l2.id}`).set(bearer(admin)).expect(200)
      ).body;
      expect(after.price).toBe(60);
      expect(
        (await ctx.http.get(`${API}/admin/listings/${l1.id}`).set(bearer(admin))).body.price,
      ).toBe(75.25);
    });

    it('rejects a second listing of the same product in the same store (409)', async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const store = await createStore(ctx, admin);
      await createListing(ctx, admin, store.storeId, product.id);
      await ctx.http
        .post(`${API}/store/listings`)
        .set(bearer(store.owner.token))
        .send({ productId: product.id, price: 10 })
        .expect(409);
    });

    it.each([
      ['zero price', { price: 0 }],
      ['negative price', { price: -10 }],
      ['price with 3 decimals', { price: 10.999 }],
      ['sale price equal to price', { price: 100, salePrice: 100 }],
      ['sale price above price', { price: 100, salePrice: 150 }],
      ['minimum below 1', { price: 100, minimumQuantity: 0 }],
      ['maximum below minimum', { price: 100, minimumQuantity: 10, maximumQuantity: 5 }],
      ['negative opening stock', { price: 100, stockQuantity: -1 }],
      ['text price', { price: 'cheap' }],
    ])('rejects %s on create', async (_label, patch) => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const store = await createStore(ctx, admin);
      await ctx.http
        .post(`${API}/store/listings`)
        .set(bearer(store.owner.token))
        .send({ productId: product.id, ...patch })
        .expect(400);
    });

    it('validates updates against the EXISTING values too (cannot make sale price exceed a new lower price)', async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const store = await createStore(ctx, admin);
      const l = await createListing(ctx, admin, store.storeId, product.id, {
        price: 100,
        salePrice: 90,
      });
      await ctx.http
        .patch(`${API}/store/listings/${l.id}`)
        .set(bearer(store.owner.token))
        .send({ price: 80 })
        .expect(400);
      await ctx.http
        .patch(`${API}/store/listings/${l.id}`)
        .set(bearer(store.owner.token))
        .send({ price: 80, salePrice: null })
        .expect(200);
    });

    it('does not let stock be edited through the listing endpoint (only via the inventory ledger)', async () => {
      const cat = await createCategory(ctx, admin);
      const product = await createProduct(ctx, admin, cat.id);
      const store = await createStore(ctx, admin);
      const l = await createListing(ctx, admin, store.storeId, product.id, { stockQuantity: 3 });
      await ctx.http
        .patch(`${API}/store/listings/${l.id}`)
        .set(bearer(store.owner.token))
        .send({ stockQuantity: 9999 })
        .expect(400);
      expect(
        (await ctx.http.get(`${API}/store/listings/${l.id}`).set(bearer(store.owner.token))).body
          .stockQuantity,
      ).toBe(3);
    });
  });

  describe('public browsing', () => {
    let storeNear: Awaited<ReturnType<typeof createStore>>;
    let storeFar: Awaited<ReturnType<typeof createStore>>;
    let categoryId: string;
    let tag: string;
    const ids: Record<string, string> = {};

    beforeAll(async () => {
      tag = unique('zq').replace(/-/g, '');
      categoryId = (await createCategory(ctx, admin)).id;
      storeNear = await createStore(ctx, admin, { latitude: -23.0167, longitude: 30.6781 }); // Malamulele
      storeFar = await createStore(ctx, admin, {
        latitude: -23.9045,
        longitude: 29.4689,
        city: 'Polokwane',
      }); // ~190 km away
      const cheap = await createProduct(ctx, admin, categoryId, {
        name: `${tag} Cheap Hammer`,
        brand: 'Tuff',
      });
      const dear = await createProduct(ctx, admin, categoryId, {
        name: `${tag} Dear Hammer`,
        brand: 'Tuff',
      });
      const nostock = await createProduct(ctx, admin, categoryId, { name: `${tag} Empty Hammer` });
      ids.cheapNear = (
        await createListing(ctx, admin, storeNear.storeId, cheap.id, {
          price: 50,
          stockQuantity: 5,
        })
      ).id;
      ids.cheapFar = (
        await createListing(ctx, admin, storeFar.storeId, cheap.id, { price: 40, stockQuantity: 5 })
      ).id;
      ids.dearNear = (
        await createListing(ctx, admin, storeNear.storeId, dear.id, {
          price: 500,
          stockQuantity: 5,
        })
      ).id;
      ids.empty = (
        await createListing(ctx, admin, storeNear.storeId, nostock.id, {
          price: 70,
          stockQuantity: 0,
        })
      ).id;
    });

    const search = async (query: Record<string, unknown>) =>
      (
        await ctx.http
          .get(`${API}/products`)
          .query({ categoryId, ...query })
          .expect(200)
      ).body as {
        data: Array<{
          id: string;
          effectivePrice: number;
          distanceKm?: number | null;
          product: { name: string };
        }>;
        meta: { total: number; totalPages: number };
      };

    it('finds products by words in name or brand, case-insensitively', async () => {
      expect((await search({ search: `${tag} hammer` })).meta.total).toBe(4);
      expect((await search({ search: `${tag.toUpperCase()} tuff` })).meta.total).toBe(3);
      expect((await search({ search: `${tag} dear` })).data[0].product.name).toContain('Dear');
      expect((await search({ search: 'no-such-thing-xyz' })).meta.total).toBe(0);
    });

    it('treats LIKE wildcards in the search box literally', async () => {
      expect((await search({ search: '%' })).meta.total).toBe(0);
      expect((await search({ search: `${tag}_hammer` })).meta.total).toBe(0);
    });

    it('sorts by price and by distance from the customer', async () => {
      const asc = await search({ search: tag, sort: 'price_asc' });
      expect(asc.data.map((d) => d.effectivePrice)).toEqual(
        [...asc.data.map((d) => d.effectivePrice)].sort((a, b) => a - b),
      );
      const desc = await search({ search: tag, sort: 'price_desc' });
      expect(desc.data[0].effectivePrice).toBe(500);
      const nearest = await search({ search: tag, sort: 'distance', lat: -23.0167, lng: 30.6781 });
      expect(nearest.data[0].distanceKm).toBeLessThan(1);
      expect(nearest.data.at(-1)!.distanceKm).toBeGreaterThan(150);
    });

    it('filters by price range, stock, store and radius', async () => {
      expect(
        (await search({ search: tag, minPrice: 45, maxPrice: 100 })).data
          .map((d) => d.effectivePrice)
          .sort(),
      ).toEqual([50, 70]);
      expect((await search({ search: tag, inStock: true })).meta.total).toBe(3); // the empty one is hidden
      expect((await search({ search: tag, storeId: storeFar.storeId })).meta.total).toBe(1);
      expect(
        (await search({ search: tag, lat: -23.0167, lng: 30.6781, radiusKm: 50 })).meta.total,
      ).toBe(3); // far store excluded
    });

    it('paginates with accurate metadata', async () => {
      const page1 = await search({ search: tag, limit: 3, page: 1 });
      const page2 = await search({ search: tag, limit: 3, page: 2 });
      expect(page1.meta).toMatchObject({ total: 4, totalPages: 2 });
      expect(page1.data).toHaveLength(3);
      expect(page2.data).toHaveLength(1);
      expect(new Set([...page1.data, ...page2.data].map((d) => d.id)).size).toBe(4); // no overlaps or gaps
    });

    it('rejects invalid query parameters', async () => {
      await ctx.http.get(`${API}/products`).query({ limit: 1000 }).expect(400);
      await ctx.http.get(`${API}/products`).query({ lat: 200, lng: 0 }).expect(400);
      await ctx.http.get(`${API}/products`).query({ sort: 'random' }).expect(400);
      await ctx.http.get(`${API}/products`).query({ categoryId: 'nope' }).expect(400);
    });

    it('hides offers from suspended, unapproved or deleted stores and from switched-off listings', async () => {
      const store = await createStore(ctx, admin);
      const product = await createProduct(ctx, admin, categoryId, { name: `${tag} Hidden Widget` });
      const listing = await createListing(ctx, admin, store.storeId, product.id);
      const visible = async () => (await search({ search: `${tag} hidden` })).meta.total;
      expect(await visible()).toBe(1);

      await ctx.http
        .patch(`${API}/store/listings/${listing.id}`)
        .set(bearer(store.owner.token))
        .send({ available: false })
        .expect(200);
      expect(await visible()).toBe(0);
      await ctx.http
        .patch(`${API}/store/listings/${listing.id}`)
        .set(bearer(store.owner.token))
        .send({ available: true })
        .expect(200);
      expect(await visible()).toBe(1);

      await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/active`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      expect(await visible()).toBe(0);
      await ctx.http.get(`${API}/stores/${store.storeId}`).expect(404);
      await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/active`)
        .set(bearer(admin))
        .send({ isActive: true })
        .expect(200);
      expect(await visible()).toBe(1);

      await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/status`)
        .set(bearer(admin))
        .send({ status: 'REJECTED', reason: 'Missing documents' })
        .expect(200);
      expect(await visible()).toBe(0);
      await ctx.http
        .post(`${API}/admin/stores/${store.storeId}/status`)
        .set(bearer(admin))
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(await visible()).toBe(1);

      await ctx.http.delete(`${API}/admin/stores/${store.storeId}`).set(bearer(admin)).expect(204);
      expect(await visible()).toBe(0);
    });
  });
});
