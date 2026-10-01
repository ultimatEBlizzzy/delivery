import {
  CategoryDto,
  CategoryRefDto,
  effectivePrice,
  getStockStatus,
  isOnSale,
  ListingDto,
  maxOrderableQuantity,
  ProductDto,
  ProductImageDto,
  StoreSummaryDto,
} from '@hardware-delivery/shared';
import { toStoreSummary } from '../stores/store.mapper';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { StoreProduct } from './entities/store-product.entity';

export const toCategoryRef = (c: Pick<Category, 'id' | 'name' | 'slug'>): CategoryRefDto => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
});

export function toCategoryDto(c: Category, listingCount?: number): CategoryDto {
  return {
    id: c.id,
    parentId: c.parentId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    icon: c.icon,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    ...(listingCount !== undefined ? { listingCount } : {}),
  };
}

export const toImageDto = (i: ProductImage): ProductImageDto => ({
  id: i.id,
  url: i.url,
  alt: i.alt,
  isPrimary: i.isPrimary,
  sortOrder: i.sortOrder,
});

/** The primary image, else the first by sort order. */
export function primaryImageUrl(images: ProductImage[] | undefined): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
  return sorted[0].url;
}

export function toProductDto(p: Product, extras: { listingCount?: number } = {}): ProductDto {
  const images = [...(p.images ?? [])].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    brand: p.brand,
    description: p.description,
    unit: p.unit,
    packSize: p.packSize,
    weightKg: p.weightKg,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    isActive: p.isActive,
    category: toCategoryRef(p.category),
    images: images.map(toImageDto),
    primaryImageUrl: images[0]?.url ?? null,
    createdByStoreId: p.createdByStoreId,
    ...(extras.listingCount !== undefined ? { listingCount: extras.listingCount } : {}),
    createdAt: p.createdAt.toISOString(),
  };
}

export function toListingDto(
  sp: StoreProduct,
  opts: { store?: StoreSummaryDto; distanceKm?: number | null } = {},
): ListingDto {
  const product = sp.product;
  const store = opts.store ?? (sp.store ? toStoreSummary(sp.store, opts.distanceKm) : undefined);
  return {
    id: sp.id,
    storeId: sp.storeId,
    productId: sp.productId,
    storeSku: sp.storeSku,
    price: sp.price,
    salePrice: sp.salePrice,
    effectivePrice: effectivePrice(sp.price, sp.salePrice),
    onSale: isOnSale(sp.price, sp.salePrice),
    stockQuantity: sp.stockQuantity,
    minimumQuantity: sp.minimumQuantity,
    maximumQuantity: sp.maximumQuantity,
    maxOrderable: sp.available
      ? maxOrderableQuantity(sp.stockQuantity, sp.minimumQuantity, sp.maximumQuantity)
      : 0,
    lowStockThreshold: sp.lowStockThreshold,
    stockStatus: getStockStatus(sp.stockQuantity, sp.lowStockThreshold),
    available: sp.available,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brand: product.brand,
      unit: product.unit,
      packSize: product.packSize,
      weightKg: product.weightKg,
      primaryImageUrl: primaryImageUrl(product.images),
      category: toCategoryRef(product.category),
      isActive: product.isActive,
    },
    ...(store ? { store } : {}),
    ...(opts.distanceKm !== undefined
      ? { distanceKm: opts.distanceKm === null ? null : Number(opts.distanceKm.toFixed(1)) }
      : {}),
    updatedAt: sp.updatedAt.toISOString(),
  };
}
