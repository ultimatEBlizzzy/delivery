import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { http } from './http';
import { useAuthStore } from '@/store/auth.store';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const authBody = (token: string) => ({
  user: {
    id: 'u1',
    email: 'a@b.co',
    firstName: 'A',
    lastName: 'B',
    roles: ['CUSTOMER'],
    phone: null,
    avatarUrl: null,
    isActive: true,
    createdAt: '',
  },
  accessToken: token,
  expiresIn: 900,
});

describe('http client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'old-token',
      user: authBody('x').user as never,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const headersOf = (call: number) =>
    (fetchMock.mock.calls[call][1]?.headers ?? {}) as Record<string, string>;

  it('sends the bearer token, CSRF header and JSON body, with credentials', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await http.post('/things', { a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/things');
    expect(init?.credentials).toBe('include');
    expect(headersOf(0)).toMatchObject({
      Authorization: 'Bearer old-token',
      'X-Requested-With': 'hd-web',
      'Content-Type': 'application/json',
    });
    expect(init?.body).toBe('{"a":1}');
  });

  it('builds query strings, skipping empty values and repeating arrays', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await http.get('/items', {
      query: { page: 2, search: '', q: undefined, tag: ['a', 'b'], flag: false },
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/items?page=2&tag=a&tag=b&flag=false');
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(http.post('/x')).resolves.toBeUndefined();
  });

  it('turns error responses into ApiError with field details', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        statusCode: 400,
        message: 'Validation failed',
        details: [{ field: 'email', messages: ['Enter a valid email'] }],
        requestId: 'r-1',
      }),
    );
    const err = (await http.post('/x', {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Validation failed', requestId: 'r-1' });
    expect(err.fieldErrors).toEqual({ email: 'Enter a valid email' });
  });

  it('reports network failures as status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = (await http.get('/x').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });

  it('on 401 refreshes the session once and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: 'expired' })) // original request
      .mockResolvedValueOnce(json(200, authBody('new-token'))) // POST /auth/refresh
      .mockResolvedValueOnce(json(200, { data: 'secret' })); // retry
    await expect(http.get('/me')).resolves.toEqual({ data: 'secret' });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/me',
      '/api/v1/auth/refresh',
      '/api/v1/me',
    ]);
    expect(headersOf(2).Authorization).toBe('Bearer new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('shares ONE refresh call between concurrent 401s (refresh tokens rotate)', async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return json(200, authBody('fresh'));
      }
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return auth === 'Bearer fresh' ? json(200, { ok: url }) : json(401, { message: 'expired' });
    });
    const results = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')]);
    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  it('signs the user out when the refresh is rejected and surfaces the 401', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: 'expired' }))
      .mockResolvedValueOnce(json(401, { message: 'session revoked' }));
    const err = (await http.get('/me').catch((e) => e)) as ApiError;
    expect(err).toMatchObject({ status: 401 });
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('does not attempt a refresh for auth endpoints (skipAuth)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { message: 'Incorrect email or password' }));
    const err = (await http
      .post('/auth/login', {}, { skipAuth: true })
      .catch((e) => e)) as ApiError;
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headersOf(0).Authorization).toBeUndefined();
  });
});
