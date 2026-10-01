import {
  CategoryRefDto,
  isOpenAt,
  StoreAdminDto,
  StoreDetailDto,
  StoreStaffDto,
  StoreSummaryDto,
} from '@hardware-delivery/shared';
import { pointToLatLng } from '../../common/utils/geo';
import { HardwareStore } from './entities/hardware-store.entity';
import { StoreStaff } from './entities/store-staff.entity';

export function toStoreSummary(
  store: HardwareStore,
  distanceKm?: number | null,
  now = new Date(),
): StoreSummaryDto {
  const { lat, lng } = pointToLatLng(store.location);
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    logoUrl: store.logoUrl,
    suburb: store.suburb,
    city: store.city,
    province: store.province,
    latitude: lat,
    longitude: lng,
    distanceKm:
      distanceKm === undefined || distanceKm === null ? null : Number(distanceKm.toFixed(1)),
    isOpenNow: isOpenAt(store.operatingHours, now),
    acceptingOrders: store.acceptingOrders,
    ratingAverage: store.ratingAverage,
    ratingCount: store.ratingCount,
  };
}

export function toStoreDetail(
  store: HardwareStore,
  categories: Array<CategoryRefDto & { listingCount: number }>,
  distanceKm?: number | null,
): StoreDetailDto {
  return {
    ...toStoreSummary(store, distanceKm),
    description: store.description,
    bannerUrl: store.bannerUrl,
    phone: store.phone,
    email: store.email,
    streetAddress: store.streetAddress,
    postalCode: store.postalCode,
    operatingHours: store.operatingHours,
    categories,
  };
}

export function toStoreAdmin(
  store: HardwareStore,
  counts: { listingCount: number; staffCount: number },
): StoreAdminDto {
  return {
    ...toStoreDetail(store, []),
    status: store.status,
    rejectionReason: store.rejectionReason,
    isActive: store.isActive,
    commissionPercent: store.commissionPercent,
    listingCount: counts.listingCount,
    staffCount: counts.staffCount,
    createdAt: store.createdAt.toISOString(),
    approvedAt: store.approvedAt ? store.approvedAt.toISOString() : null,
  };
}

export function toStaffDto(staff: StoreStaff, storeName?: string): StoreStaffDto {
  return {
    id: staff.id,
    storeId: staff.storeId,
    storeName,
    userId: staff.userId,
    role: staff.role,
    isActive: staff.isActive,
    firstName: staff.user.firstName,
    lastName: staff.user.lastName,
    email: staff.user.email,
    phone: staff.user.phone,
    createdAt: staff.createdAt.toISOString(),
  };
}
