import { create } from 'zustand';
import type { AuthResponse, AuthUserDto, Role } from '@hardware-delivery/shared';

const SESSION_FLAG = 'hd.session';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUserDto | null;
  /** Kept in memory only (never localStorage) so XSS cannot read a long-lived credential. */
  accessToken: string | null;
  setSession: (res: AuthResponse) => void;
  setUser: (user: AuthUserDto) => void;
  clear: () => void;
  hasRole: (role: Role) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  setSession: (res) => {
    localStorage.setItem(SESSION_FLAG, '1');
    set({ status: 'authenticated', user: res.user, accessToken: res.accessToken });
  },
  setUser: (user) => set({ user }),
  clear: () => {
    localStorage.removeItem(SESSION_FLAG);
    set({ status: 'anonymous', user: null, accessToken: null });
  },
  hasRole: (role) => get().user?.roles.includes(role) ?? false,
}));

/** True when this browser previously signed in (so a silent refresh is worth trying on load). */
export const hasSessionHint = () => localStorage.getItem(SESSION_FLAG) === '1';
