import type { AuthResponse, AuthUserDto } from '@hardware-delivery/shared';
import { http } from '@/lib/http';

export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput extends LoginInput {
  firstName: string;
  lastName: string;
  phone?: string;
}

export const authApi = {
  login: (input: LoginInput) => http.post<AuthResponse>('/auth/login', input, { skipAuth: true }),
  register: (input: RegisterInput) =>
    http.post<AuthResponse>('/auth/register', input, { skipAuth: true }),
  logout: () => http.post<void>('/auth/logout', undefined, { skipAuth: true }),
  logoutAll: () => http.post<void>('/auth/logout-all'),
  me: () => http.get<AuthUserDto>('/auth/me'),
  updateProfile: (input: { firstName?: string; lastName?: string; phone?: string }) =>
    http.patch<AuthUserDto>('/users/me', input),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    http.post<void>('/auth/change-password', input),
};
