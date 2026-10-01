import type { Role } from '../enums';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorDetail {
  field?: string;
  messages: string[];
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ApiErrorDetail[];
  requestId?: string;
  path?: string;
  timestamp?: string;
}

export interface GeoPointDto {
  lat: number;
  lng: number;
}

// ---- Auth ---------------------------------------------------------------------------------------
export interface StoreMembershipDto {
  storeId: string;
  storeName: string;
  staffRole: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: Role[];
  isActive: boolean;
  createdAt: string;
  /** Present for STORE users: the stores they can manage. */
  stores?: StoreMembershipDto[];
  /** Present for DRIVER users. */
  driver?: { id: string; status: string; isOnline: boolean } | null;
}

export interface AuthResponse {
  user: AuthUserDto;
  accessToken: string;
  /** Lifetime of the access token in seconds. */
  expiresIn: number;
  /** Only returned to non-browser clients that send `x-auth-mode: token`. Browsers use an httpOnly cookie. */
  refreshToken?: string;
}

export interface PublicSettingsDto {
  [key: string]: unknown;
}

export interface SettingDto {
  key: string;
  group: string;
  label: string;
  description: string;
  type: string;
  value: unknown;
  defaultValue: unknown;
  min?: number;
  max?: number;
  unit?: string;
  updatedAt: string | null;
}
