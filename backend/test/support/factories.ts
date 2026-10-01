import { Role } from '@hardware-delivery/shared';
import { PasswordService } from '../../src/modules/auth/password.service';
import { UsersService } from '../../src/modules/users/users.service';
import { TestContext } from './test-app';

export const API = '/api/v1';
export const STRONG_PASSWORD = 'Str0ngPassw0rd';

let counter = 0;
export const uniqueEmail = (prefix = 'user') =>
  `${prefix}.${Date.now().toString(36)}${(counter++).toString(36)}@test.example`;

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface TestAccount {
  email: string;
  password: string;
  token: string;
  userId: string;
}

/** Registers a customer through the public API (exercises the real registration flow). */
export async function registerCustomer(
  ctx: TestContext,
  overrides: Partial<{ email: string; firstName: string; lastName: string; phone: string }> = {},
): Promise<TestAccount & { cookies: string[] }> {
  const email = overrides.email ?? uniqueEmail('customer');
  const res = await ctx.http
    .post(`${API}/auth/register`)
    .send({
      email,
      password: STRONG_PASSWORD,
      firstName: 'Test',
      lastName: 'Customer',
      ...overrides,
    })
    .expect(201);
  return {
    email,
    password: STRONG_PASSWORD,
    token: res.body.accessToken,
    userId: res.body.user.id,
    cookies: res.headers['set-cookie'] as unknown as string[],
  };
}

/** Creates a user with arbitrary roles directly through the services, then signs in via the API. */
export async function createUserWithRoles(
  ctx: TestContext,
  roles: Role[],
  overrides: Partial<{ email: string; firstName: string; lastName: string }> = {},
): Promise<TestAccount> {
  const users = ctx.app.get(UsersService);
  const passwords = ctx.app.get(PasswordService);
  const email = overrides.email ?? uniqueEmail(roles[0].toLowerCase());
  const user = await users.create({
    email,
    passwordHash: await passwords.hash(STRONG_PASSWORD),
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? roles[0],
    roles,
  });
  const login = await ctx.http
    .post(`${API}/auth/login`)
    .send({ email, password: STRONG_PASSWORD })
    .expect(200);
  return { email, password: STRONG_PASSWORD, token: login.body.accessToken, userId: user.id };
}

export const createAdmin = (ctx: TestContext) =>
  createUserWithRoles(ctx, [Role.ADMIN], { lastName: 'Admin' });

// ---------------------------------------------------------------------------------------------
// Catalogue factories (go through the real admin API so business rules are exercised)
// ---------------------------------------------------------------------------------------------
let seq = 0;
export const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface TestStore {
  storeId: string;
  slug: string;
  name: string;
  owner: TestAccount;
}

export async function createStore(
  ctx: TestContext,
  adminToken: string,
  overrides: Record<string, unknown> = {},
): Promise<TestStore> {
  const ownerEmail = uniqueEmail('owner');
  const name = (overrides.name as string) ?? `Test Hardware ${unique('s')}`;
  const res = await ctx.http
    .post(`${API}/admin/stores`)
    .set(bearer(adminToken))
    .send({
      name,
      streetAddress: '12 Main Road',
      city: 'Malamulele',
      province: 'Limpopo',
      latitude: -23.0167,
      longitude: 30.6781,
      owner: {
        email: ownerEmail,
        firstName: 'Olivia',
        lastName: 'Owner',
        password: STRONG_PASSWORD,
      },
      ...overrides,
    })
    .expect(201);
  const login = await ctx.http
    .post(`${API}/auth/login`)
    .send({ email: ownerEmail, password: STRONG_PASSWORD })
    .expect(200);
  return {
    storeId: res.body.store.id,
    slug: res.body.store.slug,
    name,
    owner: {
      email: ownerEmail,
      password: STRONG_PASSWORD,
      token: login.body.accessToken,
      userId: login.body.user.id,
    },
  };
}

export async function createCategory(
  ctx: TestContext,
  adminToken: string,
  name = unique('Category'),
  parentId?: string,
) {
  const res = await ctx.http
    .post(`${API}/admin/categories`)
    .set(bearer(adminToken))
    .send({ name, parentId })
    .expect(201);
  return res.body as { id: string; name: string; slug: string };
}

export async function createProduct(
  ctx: TestContext,
  adminToken: string,
  categoryId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await ctx.http
    .post(`${API}/admin/products`)
    .set(bearer(adminToken))
    .send({
      categoryId,
      name: `Product ${unique('p')}`,
      sku: unique('SKU').toUpperCase(),
      unit: 'each',
      weightKg: 1,
      ...overrides,
    })
    .expect(201);
  return res.body as { id: string; name: string; sku: string; slug: string };
}

export async function createListing(
  ctx: TestContext,
  adminToken: string,
  storeId: string,
  productId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await ctx.http
    .post(`${API}/admin/listings`)
    .set(bearer(adminToken))
    .send({ storeId, productId, price: 100, stockQuantity: 10, ...overrides })
    .expect(201);
  return res.body as { id: string; price: number; salePrice: number | null; stockQuantity: number };
}

/** Smallest valid PNG (1x1 pixel). */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
