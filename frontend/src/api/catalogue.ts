import type {
  CatalogueProductDto,
  CategoryDto,
  InventoryMovementDto,
  InventoryReason,
  ListingDto,
  Paginated,
  ProductDetailDto,
  ProductDto,
  ProductImageDto,
} from '@hardware-delivery/shared';
import { http } from '@/lib/http';

export interface ListingQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  storeId?: string;
  available?: boolean;
  stock?: 'low' | 'out' | 'in';
}

export interface ListingInput {
  productId: string;
  storeSku?: string | null;
  price: number;
  salePrice?: number | null;
  stockQuantity?: number;
  minimumQuantity?: number;
  maximumQuantity?: number | null;
  lowStockThreshold?: number;
  available?: boolean;
}
export type ListingUpdate = Partial<Omit<ListingInput, 'productId' | 'stockQuantity'>>;

export interface StockAdjustment {
  mode: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  reason: InventoryReason;
  note?: string;
}

export interface ProductInput {
  categoryId: string;
  name: string;
  sku: string;
  brand?: string | null;
  description?: string | null;
  unit: string;
  packSize?: string | null;
  weightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  isActive?: boolean;
}

export interface CategoryInput {
  name: string;
  parentId?: string | null;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface MovementQuery {
  page?: number;
  limit?: number;
  storeProductId?: string;
  storeId?: string;
  reason?: string;
}

/** Store-specific offers (price/stock). `admin` can touch any store; `store` is scoped to the caller's own store. */
export function listingApi(scope: 'admin' | 'store') {
  const base = scope === 'admin' ? '/admin/listings' : '/store/listings';
  return {
    list: (query: ListingQuery) => http.get<Paginated<ListingDto>>(base, { query: { ...query } }),
    create: (body: ListingInput & { storeId?: string }) => http.post<ListingDto>(base, body),
    update: (id: string, body: ListingUpdate) => http.patch<ListingDto>(`${base}/${id}`, body),
    remove: (id: string) => http.delete<void>(`${base}/${id}`),
    adjustStock: (id: string, body: StockAdjustment) =>
      http.post<ListingDto>(`${base}/${id}/stock`, body),
    movements: (query: MovementQuery) =>
      http.get<Paginated<InventoryMovementDto>>(
        scope === 'admin' ? '/admin/inventory/movements' : '/store/inventory/movements',
        {
          query: { ...query },
        },
      ),
  };
}

export const categoryApi = {
  tree: () => http.get<CategoryDto[]>('/categories', { skipAuth: true }),
  adminTree: () => http.get<CategoryDto[]>('/admin/categories'),
  create: (body: CategoryInput) => http.post<CategoryDto>('/admin/categories', body),
  update: (id: string, body: Partial<CategoryInput>) =>
    http.patch<CategoryDto>(`/admin/categories/${id}`, body),
  remove: (id: string) => http.delete<void>(`/admin/categories/${id}`),
  setImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<CategoryDto>(`/admin/categories/${id}/image`, form);
  },
};

export interface AdminProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
}

export const productApi = {
  adminList: (query: AdminProductQuery) =>
    http.get<Paginated<ProductDto>>('/admin/products', { query: { ...query } }),
  adminGet: (id: string) => http.get<ProductDto>(`/admin/products/${id}`),
  create: (body: ProductInput) => http.post<ProductDto>('/admin/products', body),
  update: (id: string, body: Partial<ProductInput>) =>
    http.patch<ProductDto>(`/admin/products/${id}`, body),
  remove: (id: string) => http.delete<void>(`/admin/products/${id}`),
  addImage: (id: string, file: File, scope: 'admin' | 'store' = 'admin') => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<ProductImageDto>(
      scope === 'admin' ? `/admin/products/${id}/images` : `/store/catalogue/products/${id}/images`,
      form,
    );
  },
  setPrimaryImage: (id: string, imageId: string) =>
    http.post<ProductImageDto[]>(`/admin/products/${id}/images/${imageId}/primary`),
  removeImage: (id: string, imageId: string, scope: 'admin' | 'store' = 'admin') =>
    http.delete<void>(
      scope === 'admin'
        ? `/admin/products/${id}/images/${imageId}`
        : `/store/catalogue/products/${id}/images/${imageId}`,
    ),
  // store portal: global catalogue
  storeSearch: (query: { page?: number; limit?: number; search?: string; categoryId?: string }) =>
    http.get<Paginated<CatalogueProductDto>>('/store/catalogue/products', { query: { ...query } }),
  storeCreate: (body: ProductInput) => http.post<ProductDto>('/store/catalogue/products', body),
  storeUpdate: (id: string, body: Partial<ProductInput>) =>
    http.patch<ProductDto>(`/store/catalogue/products/${id}`, body),
  // public
  detail: (idOrSlug: string, query: { lat?: number; lng?: number } = {}) =>
    http.get<ProductDetailDto>(`/products/${idOrSlug}`, { query, skipAuth: true }),
};
