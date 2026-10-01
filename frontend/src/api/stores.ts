import type {
  GeocodeResultDto,
  OperatingHours,
  Paginated,
  StoreAdminDto,
  StoreDetailDto,
  StoreStaffDto,
  StoreStaffRole,
  StoreStatus,
  StoreSummaryDto,
} from '@hardware-delivery/shared';
import { http } from '@/lib/http';

export interface StoreInput {
  name: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  streetAddress: string;
  suburb?: string | null;
  city: string;
  province: string;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  operatingHours?: OperatingHours;
  commissionPercent?: number | null;
}

export interface StoreOwnerInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password?: string;
}

export interface AdminStoreQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: StoreStatus;
  isActive?: boolean;
  province?: string;
}

export interface StaffInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password?: string;
  role: StoreStaffRole;
}

export interface StaffQuery {
  page?: number;
  limit?: number;
  storeId?: string;
  search?: string;
}

export interface CreatedStore {
  store: StoreAdminDto;
  ownerCredentials?: { email: string; temporaryPassword: string };
}

export interface StaffCreated {
  staff: StoreStaffDto;
  temporaryPassword?: string;
}

export interface OwnStore extends StoreAdminDto {
  myRole: StoreStaffRole;
}

export const storeApi = {
  // public
  list: (query: {
    search?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    categoryId?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) => http.get<Paginated<StoreSummaryDto>>('/stores', { query: { ...query }, skipAuth: true }),
  get: (idOrSlug: string, query: { lat?: number; lng?: number } = {}) =>
    http.get<StoreDetailDto>(`/stores/${idOrSlug}`, { query, skipAuth: true }),

  // admin
  adminList: (query: AdminStoreQuery) =>
    http.get<Paginated<StoreAdminDto>>('/admin/stores', { query: { ...query } }),
  adminGet: (id: string) => http.get<StoreAdminDto>(`/admin/stores/${id}`),
  create: (body: StoreInput & { owner?: StoreOwnerInput }) =>
    http.post<CreatedStore>('/admin/stores', body),
  update: (id: string, body: Partial<StoreInput>) =>
    http.patch<StoreAdminDto>(`/admin/stores/${id}`, body),
  setStatus: (id: string, status: StoreStatus, reason?: string) =>
    http.post<StoreAdminDto>(`/admin/stores/${id}/status`, { status, reason }),
  setActive: (id: string, isActive: boolean) =>
    http.post<StoreAdminDto>(`/admin/stores/${id}/active`, { isActive }),
  remove: (id: string) => http.delete<void>(`/admin/stores/${id}`),
  setImage: (
    id: string,
    kind: 'logo' | 'banner',
    file: File,
    scope: 'admin' | 'store' = 'admin',
  ) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<StoreAdminDto>(
      scope === 'admin' ? `/admin/stores/${id}/${kind}` : `/store/me/${kind}`,
      form,
    );
  },

  // staff
  adminStaff: (query: StaffQuery) =>
    http.get<Paginated<StoreStaffDto>>('/admin/store-staff', { query: { ...query } }),
  adminAddStaff: (storeId: string, body: StaffInput) =>
    http.post<StaffCreated>(`/admin/stores/${storeId}/staff`, body),
  adminUpdateStaff: (
    storeId: string,
    staffId: string,
    body: { role?: StoreStaffRole; isActive?: boolean },
  ) => http.patch<StoreStaffDto>(`/admin/stores/${storeId}/staff/${staffId}`, body),
  adminRemoveStaff: (storeId: string, staffId: string) =>
    http.delete<void>(`/admin/stores/${storeId}/staff/${staffId}`),

  // store portal
  me: () => http.get<OwnStore>('/store/me'),
  updateMe: (body: {
    description?: string | null;
    phone?: string | null;
    email?: string | null;
    operatingHours?: OperatingHours;
    acceptingOrders?: boolean;
  }) => http.patch<StoreAdminDto>('/store/me', body),
  myStaff: (query: StaffQuery) =>
    http.get<Paginated<StoreStaffDto>>('/store/staff', { query: { ...query } }),
  myAddStaff: (body: StaffInput) => http.post<StaffCreated>('/store/staff', body),
  myUpdateStaff: (staffId: string, body: { role?: StoreStaffRole; isActive?: boolean }) =>
    http.patch<StoreStaffDto>(`/store/staff/${staffId}`, body),
  myRemoveStaff: (staffId: string) => http.delete<void>(`/store/staff/${staffId}`),
};

export const mapsApi = {
  geocode: (address: string) => http.post<GeocodeResultDto>('/maps/geocode', { address }),
};
