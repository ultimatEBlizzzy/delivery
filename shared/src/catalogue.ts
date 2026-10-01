import { toCents } from './money';

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

/** The price a customer pays per unit: the sale price when it is a genuine discount, else the list price. */
export function effectivePrice(price: number, salePrice: number | null | undefined): number {
  return salePrice !== null && salePrice !== undefined && toCents(salePrice) < toCents(price)
    ? salePrice
    : price;
}

export function isOnSale(price: number, salePrice: number | null | undefined): boolean {
  return effectivePrice(price, salePrice) !== price;
}

/** Percentage saved, rounded to a whole number (e.g. 15). */
export function discountPercent(price: number, salePrice: number | null | undefined): number {
  if (!isOnSale(price, salePrice) || price <= 0) return 0;
  return Math.round(((price - (salePrice as number)) / price) * 100);
}

/** The most a customer can add to the cart right now (0 when below the store's minimum or out of stock). */
export function maxOrderableQuantity(
  stock: number,
  minimum: number,
  maximum: number | null | undefined,
): number {
  const cap = maximum ? Math.min(stock, maximum) : stock;
  return cap >= minimum ? cap : 0;
}

export function getStockStatus(stock: number, lowStockThreshold: number): StockStatus {
  if (stock <= 0) return 'OUT_OF_STOCK';
  return stock <= lowStockThreshold ? 'LOW_STOCK' : 'IN_STOCK';
}

export const STOCK_STATUS_LABELS: Readonly<Record<StockStatus, string>> = {
  OUT_OF_STOCK: 'Out of stock',
  LOW_STOCK: 'Low stock',
  IN_STOCK: 'In stock',
};

/** Product units offered in the catalogue form. */
export const PRODUCT_UNITS = [
  'each',
  'bag',
  'box',
  'pack',
  'roll',
  'm',
  'm²',
  'm³',
  'kg',
  'litre',
  'pair',
  'set',
  'sheet',
  'length',
] as const;
