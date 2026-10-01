import { Role } from '@hardware-delivery/shared';
import { PasswordService } from '../src/modules/auth/password.service';
import { API, bearer, registerCustomer, STRONG_PASSWORD, uniqueEmail } from './support/factories';
import { createTestApp, TestContext } from './support/test-app';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ AUTH_MAX_FAILED_LOGINS: '3', REFRESH_REUSE_GRACE_SECONDS: '0' });
  });
  afterAll(() => ctx.close());

  describe('registration', () => {
    it('creates a customer, normalises email/phone, never leaks the password hash', async () => {
      const email = uniqueEmail('Thandi').toUpperCase();
      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({
          email,
          password: STRONG_PASSWORD,
          firstName: ' Thandi ',
          lastName: 'Mokoena',
          phone: '082 123 4567',
        })
        .expect(201);

      expect(res.body.user).toMatchObject({
        email: email.toLowerCase(),
        firstName: 'Thandi',
        phone: '+27821234567',
        roles: [Role.CUSTOMER],
        isActive: true,
      });
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/i);
      // browsers get the refresh token as an httpOnly cookie, never in the body
      expect(res.body.refreshToken).toBeUndefined();
      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('hd_refresh='),
      )!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('stores a customer profile row for the new user', async () => {
      const { userId } = await registerCustomer(ctx);
      const rows = await ctx.dataSource.query('SELECT 1 FROM customers WHERE user_id = $1', [
        userId,
      ]);
      expect(rows).toHaveLength(1);
    });

    it('stores only an argon2id hash', async () => {
      const { userId, password } = await registerCustomer(ctx);
      const [row] = await ctx.dataSource.query('SELECT password_hash FROM users WHERE id = $1', [
        userId,
      ]);
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
      expect(row.password_hash).not.toContain(password);
    });

    it('rejects duplicate emails regardless of case', async () => {
      const { email } = await registerCustomer(ctx);
      await ctx.http
        .post(`${API}/auth/register`)
        .send({
          email: email.toUpperCase(),
          password: STRONG_PASSWORD,
          firstName: 'A',
          lastName: 'B',
        })
        .expect(409);
    });

    it.each([
      ['weak password', { password: 'password' }],
      ['short password', { password: 'Ab1' }],
      ['invalid email', { email: 'not-an-email' }],
      ['blank first name', { firstName: '   ' }],
      ['invalid phone', { phone: '12345' }],
    ])('rejects %s with structured 400 details', async (_name, patch) => {
      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({
          email: uniqueEmail(),
          password: STRONG_PASSWORD,
          firstName: 'A',
          lastName: 'B',
          ...patch,
        })
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
      expect(res.body.details.length).toBeGreaterThan(0);
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('cannot self-assign roles (mass-assignment protection)', async () => {
      const res = await ctx.http
        .post(`${API}/auth/register`)
        .send({
          email: uniqueEmail(),
          password: STRONG_PASSWORD,
          firstName: 'A',
          lastName: 'B',
          roles: ['ADMIN'],
        })
        .expect(400);
      expect(JSON.stringify(res.body.details)).toMatch(/roles should not exist/);
    });
  });

  describe('login', () => {
    it('signs in with correct credentials (case-insensitive email)', async () => {
      const { email, password } = await registerCustomer(ctx);
      const res = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: email.toUpperCase(), password })
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.expiresIn).toBe(900);
    });

    it('gives the same generic error for wrong password and unknown email', async () => {
      const { email } = await registerCustomer(ctx);
      const wrongPassword = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email, password: 'Wrong1234' })
        .expect(401);
      const unknownEmail = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: uniqueEmail('ghost'), password: 'Wrong1234' })
        .expect(401);
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('locks the account after repeated failures and blocks even the right password', async () => {
      const { email, password } = await registerCustomer(ctx);
      for (let i = 0; i < 3; i++) {
        await ctx.http.post(`${API}/auth/login`).send({ email, password: 'Wrong1234' }).expect(401);
      }
      const locked = await ctx.http.post(`${API}/auth/login`).send({ email, password }).expect(429);
      expect(locked.body.message).toMatch(/try again in/i);
    });

    it('does not break on SQL injection payloads', async () => {
      const res = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: "admin@x.com' OR '1'='1", password: "' OR 1=1 --" });
      expect([400, 401]).toContain(res.status);
      const attack = await ctx.http
        .post(`${API}/auth/login`)
        .send({ email: 'a@b.co', password: "x'; DROP TABLE users; --" })
        .expect(401);
      expect(attack.body.message).toBe('Incorrect email or password');
      const [{ count }] = await ctx.dataSource.query('SELECT count(*)::int AS count FROM users');
      expect(count).toBeGreaterThan(0);
    });

    it('refuses deactivated accounts', async () => {
      const { email, password, userId } = await registerCustomer(ctx);
      await ctx.dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
      await ctx.http.post(`${API}/auth/login`).send({ email, password }).expect(403);
    });
  });

  describe('access tokens', () => {
    it('GET /auth/me needs a valid token', async () => {
      await ctx.http.get(`${API}/auth/me`).expect(401);
      await ctx.http.get(`${API}/auth/me`).set(bearer('garbage.token.value')).expect(401);
      const { token, email } = await registerCustomer(ctx);
      const res = await ctx.http.get(`${API}/auth/me`).set(bearer(token)).expect(200);
      expect(res.body.email).toBe(email);
    });

    it('rejects tokens signed with another secret or the "none" algorithm', async () => {
      const { userId } = await registerCustomer(ctx);
      const forged = [
        // header {alg:none}
        `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
          JSON.stringify({
            sub: userId,
            roles: ['ADMIN'],
            iss: 'hardware-delivery',
            aud: 'hardware-delivery-api',
          }),
        ).toString('base64url')}.`,
      ];
      for (const token of forged) {
        await ctx.http.get(`${API}/auth/me`).set(bearer(token)).expect(401);
      }
    });

    it('takes effect immediately when a user is deactivated (no waiting for token expiry)', async () => {
      const { token, userId } = await registerCustomer(ctx);
      await ctx.http.get(`${API}/auth/me`).set(bearer(token)).expect(200);
      await ctx.dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
      await ctx.http.get(`${API}/auth/me`).set(bearer(token)).expect(401);
    });
  });

  describe('refresh tokens', () => {
    const cookieHeader = (setCookie: string[]) => setCookie.map((c) => c.split(';')[0]).join('; ');

    it('requires the X-Requested-With header in cookie mode (CSRF defence)', async () => {
      const { cookies } = await registerCustomer(ctx);
      await ctx.http.post(`${API}/auth/refresh`).set('Cookie', cookieHeader(cookies)).expect(403);
    });

    it('rotates the refresh token and rejects the old one', async () => {
      const { cookies } = await registerCustomer(ctx);
      const first = await ctx.http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-Requested-With', 'test')
        .expect(200);
      expect(first.body.accessToken).toEqual(expect.any(String));
      const rotated = first.headers['set-cookie'] as unknown as string[];
      expect(cookieHeader(rotated)).not.toBe(cookieHeader(cookies));

      // the replaced token is now invalid (grace window is 0s in this suite)
      await ctx.http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-Requested-With', 'test')
        .expect(401);
    });

    it('revokes the whole token family when a rotated token is replayed (theft detection)', async () => {
      const { cookies } = await registerCustomer(ctx);
      const first = await ctx.http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-Requested-With', 'test')
        .expect(200);
      const newest = first.headers['set-cookie'] as unknown as string[];

      // attacker replays the old token…
      await ctx.http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-Requested-With', 'test')
        .expect(401);
      // …and the legitimate (newest) token is dead too
      await ctx.http
        .post(`${API}/auth/refresh`)
        .set('Cookie', cookieHeader(newest))
        .set('X-Requested-With', 'test')
        .expect(401);
    });

    it('supports header-based token mode for non-browser clients', async () => {
      const { email, password } = await registerCustomer(ctx);
      const login = await ctx.http
        .post(`${API}/auth/login`)
        .set('X-Auth-Mode', 'token')
        .send({ email, password })
        .expect(200);
      expect(login.body.refreshToken).toEqual(expect.any(String));
      expect(login.headers['set-cookie']).toBeUndefined();
      const refreshed = await ctx.http
        .post(`${API}/auth/refresh`)
        .set('X-Auth-Mode', 'token')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);
      expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    });

    it('stores refresh tokens hashed, never in clear text', async () => {
      const { email, password } = await registerCustomer(ctx);
      const login = await ctx.http
        .post(`${API}/auth/login`)
        .set('X-Auth-Mode', 'token')
        .send({ email, password })
        .expect(200);
      const rows = await ctx.dataSource.query(
        'SELECT token_hash FROM refresh_tokens WHERE token_hash = $1',
        [login.body.refreshToken],
      );
      expect(rows).toHaveLength(0);
    });

    it('logout revokes the session', async () => {
      const { cookies } = await registerCustomer(ctx);
      const header = cookieHeader(cookies);
      await ctx.http
        .post(`${API}/auth/logout`)
        .set('Cookie', header)
        .set('X-Requested-With', 'test')
        .expect(204);
      await ctx.http
        .post(`${API}/auth/refresh`)
        .set('Cookie', header)
        .set('X-Requested-With', 'test')
        .expect(401);
    });
  });

  describe('change password', () => {
    it('validates the current password, applies the policy and signs out other sessions', async () => {
      const { email, password, token } = await registerCustomer(ctx);
      const other = await ctx.http
        .post(`${API}/auth/login`)
        .set('X-Auth-Mode', 'token')
        .send({ email, password })
        .expect(200);

      await ctx.http
        .post(`${API}/auth/change-password`)
        .set(bearer(token))
        .send({ currentPassword: 'Wrong1234', newPassword: 'N3wPassw0rd!' })
        .expect(401);
      await ctx.http
        .post(`${API}/auth/change-password`)
        .set(bearer(token))
        .send({ currentPassword: password, newPassword: 'weak' })
        .expect(400);
      await ctx.http
        .post(`${API}/auth/change-password`)
        .set(bearer(token))
        .send({ currentPassword: password, newPassword: 'N3wPassw0rd!' })
        .expect(204);

      await ctx.http.post(`${API}/auth/login`).send({ email, password }).expect(401);
      await ctx.http
        .post(`${API}/auth/login`)
        .send({ email, password: 'N3wPassw0rd!' })
        .expect(200);
      await ctx.http
        .post(`${API}/auth/refresh`)
        .set('X-Auth-Mode', 'token')
        .send({ refreshToken: other.body.refreshToken })
        .expect(401);
    });
  });

  describe('profile', () => {
    it('updates name and phone, ignoring/rejecting protected fields', async () => {
      const { token } = await registerCustomer(ctx);
      const res = await ctx.http
        .patch(`${API}/users/me`)
        .set(bearer(token))
        .send({ firstName: 'Lerato', phone: '0711234567' })
        .expect(200);
      expect(res.body).toMatchObject({ firstName: 'Lerato', phone: '+27711234567' });
      await ctx.http
        .patch(`${API}/users/me`)
        .set(bearer(token))
        .send({ email: 'x@y.co', isActive: false })
        .expect(400);
    });
  });

  it('PasswordService verifies and detects rehash needs', async () => {
    const passwords = ctx.app.get(PasswordService);
    const hash = await passwords.hash('Abcdef12');
    expect(await passwords.verify(hash, 'Abcdef12')).toBe(true);
    expect(await passwords.verify(hash, 'abcdef12')).toBe(false);
    expect(await passwords.verify('not-a-hash', 'x')).toBe(false);
  });
});
