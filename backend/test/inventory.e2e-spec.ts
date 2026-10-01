import { InventoryReason } from '@hardware-delivery/shared';
import {
  API,
  bearer,
  createAdmin,
  createCategory,
  createListing,
  createProduct,
  createStore,
} from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('Inventory ledger and stock safety (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = (await createAdmin(ctx)).token;
    categoryId = (await createCategory(ctx, admin)).id;
  });
  afterAll(() => ctx.close());

  async function setup(stock = 10) {
    const store = await createStore(ctx, admin);
    const product = await createProduct(ctx, admin, categoryId);
    const listing = await createListing(ctx, admin, store.storeId, product.id, {
      stockQuantity: stock,
    });
    const adjust = (body: Record<string, unknown>, token = store.owner.token) =>
      ctx.http.post(`${API}/store/listings/${listing.id}/stock`).set(bearer(token)).send(body);
    const ledger = async () =>
      (await ctx.dataSource.query(
        'SELECT change, quantity_after, reason, note FROM inventory WHERE store_product_id = $1 ORDER BY created_at, id',
        [listing.id],
      )) as Array<{
        change: number;
        quantity_after: number;
        reason: string;
        note: string | null;
      }>;
    const stock$ = async () =>
      (
        await ctx.dataSource.query('SELECT stock_quantity FROM store_products WHERE id = $1', [
          listing.id,
        ])
      )[0].stock_quantity as number;
    return { store, product, listing, adjust, ledger, stock$ };
  }

  it('records opening stock in the ledger', async () => {
    const { ledger } = await setup(25);
    expect(await ledger()).toEqual([
      {
        change: 25,
        quantity_after: 25,
        reason: InventoryReason.INITIAL_STOCK,
        note: 'Opening stock',
      },
    ]);
  });

  it('adds, removes and sets stock, writing a ledger row per change that always reconciles', async () => {
    const { adjust, ledger, stock$ } = await setup(10);
    expect(
      (
        await adjust({
          mode: 'ADD',
          quantity: 5,
          reason: 'RESTOCK',
          note: 'Delivery from supplier',
        }).expect(200)
      ).body.stockQuantity,
    ).toBe(15);
    expect(
      (
        await adjust({
          mode: 'REMOVE',
          quantity: 3,
          reason: 'CORRECTION',
          note: 'Damaged bags',
        }).expect(200)
      ).body.stockQuantity,
    ).toBe(12);
    expect(
      (await adjust({ mode: 'SET', quantity: 40, reason: 'ADJUSTMENT' }).expect(200)).body
        .stockQuantity,
    ).toBe(40);

    const rows = await ledger();
    expect(rows.map((r) => r.change)).toEqual([10, 5, -3, 28]);
    expect(rows.map((r) => r.quantity_after)).toEqual([10, 15, 12, 40]);
    expect(rows[2]).toMatchObject({ reason: 'CORRECTION', note: 'Damaged bags' });
    // the ledger always sums to the live stock level
    expect(rows.reduce((sum, r) => sum + r.change, 0)).toBe(await stock$());
  });

  it('writes no ledger row when nothing changes', async () => {
    const { adjust, ledger } = await setup(10);
    await adjust({ mode: 'SET', quantity: 10, reason: 'CORRECTION' }).expect(200);
    expect(await ledger()).toHaveLength(1);
  });

  it('cannot remove more than is in stock (stock never goes negative) and leaves no trace', async () => {
    const { adjust, ledger, stock$ } = await setup(4);
    const res = await adjust({ mode: 'REMOVE', quantity: 5, reason: 'ADJUSTMENT' }).expect(409);
    expect(res.body.message).toMatch(/only 4 in stock/);
    expect(await stock$()).toBe(4);
    expect(await ledger()).toHaveLength(1);
  });

  it.each([
    ['system reason SALE', { mode: 'ADD', quantity: 1, reason: 'SALE' }],
    ['system reason INITIAL_STOCK', { mode: 'ADD', quantity: 1, reason: 'INITIAL_STOCK' }],
    ['unknown mode', { mode: 'MULTIPLY', quantity: 2, reason: 'RESTOCK' }],
    ['negative quantity', { mode: 'ADD', quantity: -5, reason: 'RESTOCK' }],
    ['fractional quantity', { mode: 'ADD', quantity: 1.5, reason: 'RESTOCK' }],
    ['absurd quantity', { mode: 'ADD', quantity: 99_999_999, reason: 'RESTOCK' }],
    ['ADD of zero', { mode: 'ADD', quantity: 0, reason: 'RESTOCK' }],
    ['missing reason', { mode: 'ADD', quantity: 1 }],
    ['over-long note', { mode: 'ADD', quantity: 1, reason: 'RESTOCK', note: 'x'.repeat(301) }],
  ])('rejects %s', async (_label, body) => {
    const { adjust, stock$ } = await setup(10);
    await adjust(body).expect(400);
    expect(await stock$()).toBe(10);
  });

  it('NEVER oversells under concurrency: 12 simultaneous removals of 1 from a stock of 5 succeed exactly 5 times', async () => {
    const { adjust, ledger, stock$ } = await setup(5);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        adjust({ mode: 'REMOVE', quantity: 1, reason: 'ADJUSTMENT' }),
      ),
    );
    const ok = results.filter((r) => r.status === 200).length;
    const conflicts = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(5);
    expect(conflicts).toBe(7);
    expect(await stock$()).toBe(0);
    const rows = await ledger();
    expect(rows).toHaveLength(6); // opening stock + 5 removals
    expect(rows.reduce((sum, r) => sum + r.change, 0)).toBe(0);
    expect(rows.every((r) => r.quantity_after >= 0)).toBe(true);
  });

  it('keeps the database CHECK constraint as a last line of defence', async () => {
    const { listing } = await setup(3);
    await expect(
      ctx.dataSource.query('UPDATE store_products SET stock_quantity = -1 WHERE id = $1', [
        listing.id,
      ]),
    ).rejects.toThrow(/chk_store_products_stock/);
    await expect(
      ctx.dataSource.query('UPDATE store_products SET sale_price = price WHERE id = $1', [
        listing.id,
      ]),
    ).rejects.toThrow(/chk_store_products_sale_price/);
  });

  it('reports stock status and low-stock filtering', async () => {
    const store = await createStore(ctx, admin);
    const mk = async (stock: number, threshold: number) => {
      const p = await createProduct(ctx, admin, categoryId);
      return createListing(ctx, admin, store.storeId, p.id, {
        stockQuantity: stock,
        lowStockThreshold: threshold,
      });
    };
    const out = await mk(0, 5);
    const low = await mk(3, 5);
    const fine = await mk(50, 5);
    const list = async (stock: string) =>
      (
        (
          await ctx.http
            .get(`${API}/store/listings`)
            .query({ stock })
            .set(bearer(store.owner.token))
            .expect(200)
        ).body.data as Array<{ id: string }>
      ).map((l) => l.id);
    expect(await list('out')).toEqual([out.id]);
    expect(await list('low')).toEqual([low.id]);
    expect(await list('in')).toEqual([fine.id]);
    const detail = await ctx.http
      .get(`${API}/store/listings/${low.id}`)
      .set(bearer(store.owner.token))
      .expect(200);
    expect(detail.body).toMatchObject({ stockStatus: 'LOW_STOCK', maxOrderable: 3 });
    expect(
      (await ctx.http.get(`${API}/store/listings/${out.id}`).set(bearer(store.owner.token))).body,
    ).toMatchObject({ stockStatus: 'OUT_OF_STOCK', maxOrderable: 0 });
  });

  it('shows each store only its own movements, with who did what; admins see everything', async () => {
    const a = await setup(10);
    const b = await setup(10);
    await a.adjust({ mode: 'ADD', quantity: 2, reason: 'RESTOCK', note: 'from A' }).expect(200);
    await b.adjust({ mode: 'ADD', quantity: 9, reason: 'RESTOCK', note: 'from B' }).expect(200);

    const mine = (
      await ctx.http
        .get(`${API}/store/inventory/movements`)
        .set(bearer(a.store.owner.token))
        .expect(200)
    ).body;
    expect(
      mine.data.every((m: { storeProductId: string }) => m.storeProductId === a.listing.id),
    ).toBe(true);
    expect(mine.data[0]).toMatchObject({
      change: 2,
      reason: 'RESTOCK',
      note: 'from A',
      actorName: 'Olivia Owner',
    });
    expect(mine.data[0].product.sku).toBe(a.product.sku);
    // asking for another store's listing through filters returns nothing, not an error leak
    const peek = (
      await ctx.http
        .get(`${API}/store/inventory/movements`)
        .query({ storeProductId: b.listing.id })
        .set(bearer(a.store.owner.token))
        .expect(200)
    ).body;
    expect(peek.data).toHaveLength(0);

    const all = (
      await ctx.http
        .get(`${API}/admin/inventory/movements`)
        .query({ storeProductId: b.listing.id })
        .set(bearer(admin))
        .expect(200)
    ).body;
    expect(all.data.map((m: { note: string | null }) => m.note)).toEqual([
      'from B',
      'Opening stock',
    ]);
    expect(all.meta.total).toBe(2);
  });

  it("lets an administrator adjust any store's stock and records them as the actor", async () => {
    const { listing, ledger, stock$ } = await setup(10);
    await ctx.http
      .post(`${API}/admin/listings/${listing.id}/stock`)
      .set(bearer(admin))
      .send({ mode: 'REMOVE', quantity: 4, reason: 'CORRECTION', note: 'audit count' })
      .expect(200);
    expect(await stock$()).toBe(6);
    const [, last] = await ledger();
    expect(last).toMatchObject({ change: -4, note: 'audit count' });
    const [row] = await ctx.dataSource.query(
      'SELECT actor_user_id FROM inventory WHERE store_product_id = $1 ORDER BY created_at DESC LIMIT 1',
      [listing.id],
    );
    expect(row.actor_user_id).toBeTruthy();
  });
});
