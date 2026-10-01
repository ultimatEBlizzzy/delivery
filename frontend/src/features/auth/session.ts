import { authApi } from '@/api/auth';
import { refreshSession } from '@/lib/http';
import { queryClient } from '@/lib/query-client';
import { hasSessionHint, useAuthStore } from '@/store/auth.store';

/**
 * Runs once on app start. If this browser has signed in before, silently exchange the httpOnly
 * refresh cookie for an access token so a page reload keeps the user signed in.
 */
export async function bootstrapSession(): Promise<void> {
  if (!hasSessionHint()) {
    useAuthStore.getState().clear();
    return;
  }
  const ok = await refreshSession();
  // Network failure (not a rejected session): stay anonymous but keep the hint for next time.
  if (!ok && useAuthStore.getState().status === 'loading')
    useAuthStore.setState({ status: 'anonymous' });
}

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    /* the local session is cleared regardless */
  }
  useAuthStore.getState().clear();
  queryClient.clear();
}

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<string, string> = {
  CUSTOMER: '/',
  DRIVER: '/driver',
  STORE: '/store',
  ADMIN: '/admin',
};

export const PORTAL_LOGIN: Record<string, string> = {
  CUSTOMER: '/login',
  DRIVER: '/driver/login',
  STORE: '/store/login',
  ADMIN: '/admin/login',
};
