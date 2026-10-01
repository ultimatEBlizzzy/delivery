import type { InventoryReason, StoreStaffRole, StoreStatus } from '../enums';
import type { OperatingHours } from '../constants';
import type { StockStatus } from '../catalogue';

export interface CategoryDto {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Number of purchasable listings in this category and its sub-categories. */
  listingCount?: number;
  children?: CategoryDto[];
}

export interface CategoryRefDto {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImageDto {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string | null;
  description: string | null;
  unit: string;
  packSize: string | null;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  isActive: boolean;
  category: CategoryRefDto;
  images: ProductImageDto[];
  primaryImageUrl: string | null;
  createdByStoreId: string | null;
  listingCount?: number;
  createdAt: string;
}

export interface StoreSummaryDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  suburb: string | null;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  /** Straight-line distance from the customer's location, when one was supplied. */
  distanceKm?: number | null;
  isOpenNow: boolean;
  acceptingOrders: boolean;
  ratingAverage: number;
  ratingCount: number;
}

export interface StoreDetailDto extends StoreSummaryDto {
  description: string | null;
  bannerUrl: string | null;
  phone: string | null;
  email: string | null;
  streetAddress: string;
  postalCode: string | null;
  operatingHours: OperatingHours;
  categories: Array<CategoryRefDto & { listingCount: number }>;
}

export interface StoreAdminDto extends StoreDetailDto {
  status: StoreStatus;
  rejectionReason: string | null;
  isActive: boolean;
  commissionPercent: number | null;
  listingCount: number;
  staffCount: number;
  createdAt: string;
  approvedAt: string | null;
}

export interface ListingProductDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string | null;
  unit: string;
  packSize: string | null;
  weightKg: number;
  primaryImageUrl: string | null;
  category: CategoryRefDto;
  isActive: boolean;
}

/** A store-specific offer for a global product. */
export interface ListingDto {
  id: string;
  storeId: string;
  productId: string;
  storeSku: string | null;
  price: number;
  salePrice: number | null;
  /** What the customer actually pays per unit. */
  effectivePrice: number;
  onSale: boolean;
  stockQuantity: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  /** The most that can be ordered right now (0 = cannot be ordered). */
  maxOrderable: number;
  lowStockThreshold: number;
  stockStatus: StockStatus;
  available: boolean;
  product: ListingProductDto;
  store?: StoreSummaryDto;
  distanceKm?: number | null;
  updatedAt: string;
}

export interface ProductDetailDto extends ProductDto {
  categoryPath: CategoryRefDto[];
  offers: ListingDto[];
}

export interface InventoryMovementDto {
  id: string;
  storeProductId: string;
  change: number;
  quantityAfter: number;
  reason: InventoryReason;
  orderId: string | null;
  note: string | null;
  actorName: string | null;
  createdAt: string;
  product?: { id: string; name: string; sku: string };
}

export interface StoreStaffDto {
  id: string;
  storeId: string;
  storeName?: string;
  userId: string;
  role: StoreStaffRole;
  isActive: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export interface GeocodeResultDto {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  /** 0..1 – how sure the provider is. */
  confidence: number;
  suburb?: string;
  city?: string;
  province?: string;
}

/** A global product as seen by a store choosing what to list. */
export interface CatalogueProductDto extends ProductDto {
  /** True when the signed-in store already has a listing for this product. */
  listedByStore: boolean;
  listingId: string | null;
}
