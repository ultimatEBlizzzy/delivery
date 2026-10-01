/**
 * Raw SQL predicates describing what a CUSTOMER may see. Aliases used throughout the catalogue
 * queries: sp = store_products, p = products, s = hardware_stores.
 */
export const VISIBLE_STORE_SQL = `s.deleted_at IS NULL AND s.status = 'APPROVED' AND s.is_active = true`;
export const VISIBLE_PRODUCT_SQL = `p.deleted_at IS NULL AND p.is_active = true`;
export const VISIBLE_LISTING_SQL = `sp.deleted_at IS NULL AND sp.available = true`;
