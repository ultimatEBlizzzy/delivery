import {
  API,
  bearer,
  createAdmin,
  createCategory,
  createProduct,
  createStore,
  TINY_PNG,
  unique,
} from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('File uploads (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = (await createAdmin(ctx)).token;
    categoryId = (await createCategory(ctx, admin)).id;
  });
  afterAll(() => ctx.close());

  const upload = (
    productId: string,
    token: string,
    file: Buffer,
    filename = 'photo.png',
    contentType = 'image/png',
  ) =>
    ctx.http
      .post(`${API}/admin/products/${productId}/images`)
      .set(bearer(token))
      .attach('file', file, { filename, contentType });

  it('stores a real image, serves it publicly with a locked-down CSP, and the first image becomes primary', async () => {
    const product = await createProduct(ctx, admin, categoryId);
    const res = await upload(product.id, admin, TINY_PNG).expect(201);
    expect(res.body).toMatchObject({ isPrimary: true });
    expect(res.body.url).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);

    const file = await ctx.http.get(res.body.url).expect(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);
    expect(file.headers['content-security-policy']).toContain("default-src 'none'");
    expect(file.headers['x-content-type-options']).toBe('nosniff');

    const second = await upload(product.id, admin, TINY_PNG).expect(201);
    expect(second.body.isPrimary).toBe(false);
    const detail = await ctx.http
      .get(`${API}/admin/products/${product.id}`)
      .set(bearer(admin))
      .expect(200);
    expect(detail.body.images).toHaveLength(2);
    expect(detail.body.primaryImageUrl).toBe(res.body.url);
  });

  it('rejects files that are not really images, whatever their name or declared type', async () => {
    const product = await createProduct(ctx, admin, categoryId);
    await upload(
      product.id,
      admin,
      Buffer.from('<?php echo "pwned"; ?>'.padEnd(64)),
      'shell.png',
      'image/png',
    ).expect(400);
    await upload(
      product.id,
      admin,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      'x.svg',
      'image/svg+xml',
    ).expect(400);
    await upload(
      product.id,
      admin,
      Buffer.from('%PDF-1.7 not allowed for product photos'.padEnd(64)),
      'doc.pdf',
      'application/pdf',
    ).expect(400);
    await ctx.http
      .post(`${API}/admin/products/${product.id}/images`)
      .set(bearer(admin))
      .expect(400); // no file at all
  });

  it('rejects oversized uploads with 413', async () => {
    const product = await createProduct(ctx, admin, categoryId);
    const huge = Buffer.concat([TINY_PNG, Buffer.alloc(6 * 1024 * 1024)]);
    await upload(product.id, admin, huge).expect(413);
  });

  it('limits a product to 8 images, supports changing the primary image and deleting images (and their files)', async () => {
    const product = await createProduct(ctx, admin, categoryId);
    const urls: Array<{ id: string; url: string }> = [];
    for (let i = 0; i < 8; i++)
      urls.push((await upload(product.id, admin, TINY_PNG).expect(201)).body);
    await upload(product.id, admin, TINY_PNG).expect(400);

    await ctx.http
      .post(`${API}/admin/products/${product.id}/images/${urls[3].id}/primary`)
      .set(bearer(admin))
      .expect(200);
    const detail = await ctx.http
      .get(`${API}/admin/products/${product.id}`)
      .set(bearer(admin))
      .expect(200);
    expect(detail.body.primaryImageUrl).toBe(urls[3].url);
    expect(detail.body.images.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(1);

    await ctx.http
      .delete(`${API}/admin/products/${product.id}/images/${urls[3].id}`)
      .set(bearer(admin))
      .expect(204);
    await ctx.http.get(urls[3].url).expect(404); // file really gone
    const after = await ctx.http
      .get(`${API}/admin/products/${product.id}`)
      .set(bearer(admin))
      .expect(200);
    expect(after.body.images).toHaveLength(7);
    expect(after.body.images.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(1); // a new primary was promoted
  });

  it('only lets stores upload images to products they created and own exclusively', async () => {
    const store = await createStore(ctx, admin);
    const shared = await createProduct(ctx, admin, categoryId);
    await ctx.http
      .post(`${API}/store/catalogue/products/${shared.id}/images`)
      .set(bearer(store.owner.token))
      .attach('file', TINY_PNG, 'a.png')
      .expect(403);

    const mine = await ctx.http
      .post(`${API}/store/catalogue/products`)
      .set(bearer(store.owner.token))
      .send({
        categoryId,
        name: 'Mine',
        sku: unique('IMG').toUpperCase(),
        unit: 'each',
        weightKg: 1,
      })
      .expect(201);
    await ctx.http
      .post(`${API}/store/catalogue/products/${mine.body.id}/images`)
      .set(bearer(store.owner.token))
      .attach('file', TINY_PNG, 'a.png')
      .expect(201);
  });

  it('requires authentication and the right role for uploads', async () => {
    const product = await createProduct(ctx, admin, categoryId);
    const store = await createStore(ctx, admin);
    await ctx.http
      .post(`${API}/admin/products/${product.id}/images`)
      .attach('file', TINY_PNG, 'a.png')
      .expect(401);
    await ctx.http
      .post(`${API}/admin/products/${product.id}/images`)
      .set(bearer(store.owner.token))
      .attach('file', TINY_PNG, 'a.png')
      .expect(403);
  });

  it('stores logos and category images for admins', async () => {
    const store = await createStore(ctx, admin);
    const logo = await ctx.http
      .post(`${API}/admin/stores/${store.storeId}/logo`)
      .set(bearer(admin))
      .attach('file', TINY_PNG, 'logo.png')
      .expect(201);
    expect(logo.body.logoUrl).toMatch(/^\/uploads\/stores\//);
    const own = await ctx.http
      .post(`${API}/store/me/banner`)
      .set(bearer(store.owner.token))
      .attach('file', TINY_PNG, 'b.png')
      .expect(201);
    expect(own.body.bannerUrl).toMatch(/^\/uploads\/stores\//);
    const category = await ctx.http
      .post(`${API}/admin/categories/${categoryId}/image`)
      .set(bearer(admin))
      .attach('file', TINY_PNG, 'c.png')
      .expect(201);
    expect(category.body.imageUrl).toMatch(/^\/uploads\/categories\//);
  });

  it('does not expose files outside the public folder or accept invalid private-file signatures', async () => {
    await ctx.http.get('/uploads/../private/x.png').expect(404);
    await ctx.http.get('/uploads/%2e%2e/%2e%2e/etc/passwd').expect(404);
    await ctx.http
      .get(`${API}/files/private/driver-documents/abc.pdf?exp=9999999999&sig=forged`)
      .expect(403);
    await ctx.http.get(`${API}/files/private/driver-documents/abc.pdf`).expect(403);
  });
});
