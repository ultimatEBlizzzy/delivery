import { z } from 'zod';
import { toCents } from '@hardware-delivery/shared';

/**
 * Form fields are kept as STRINGS (exactly what the user typed) and validated/converted explicitly.
 * That avoids NaN-for-empty-input surprises of valueAsNumber and keeps zod/react-hook-form typing simple.
 */
const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

export const parseNumber = (v: string): number =>
  Number(v.trim().replace(/\s/g, '').replace(',', '.'));

export const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (v) => MONEY.test(v.replace(',', '.')) && parseNumber(v) > 0,
      `Enter ${label.toLowerCase()} like 109.99`,
    );

export const optionalMoneyField = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (MONEY.test(v.replace(',', '.')) && parseNumber(v) > 0),
      `Enter ${label.toLowerCase()} like 99.99 or leave blank`,
    );

export const intField = (label: string, min = 0, max = 1_000_000) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^-?\d+$/.test(v), `${label} must be a whole number`)
    .refine((v) => Number(v) >= min, `${label} must be at least ${min}`)
    .refine((v) => Number(v) <= max, `${label} must be at most ${max.toLocaleString('en-ZA')}`);

export const optionalIntField = (label: string, min = 1, max = 1_000_000) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max),
      `${label} must be a whole number from ${min} to ${max.toLocaleString('en-ZA')}, or blank`,
    );

export const decimalField = (label: string, min = 0, max = 100_000, decimals = 3) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (v) => Number.isFinite(parseNumber(v)) && /^\d+([.,]\d+)?$/.test(v),
      `${label} must be a number`,
    )
    .refine((v) => parseNumber(v) >= min, `${label} cannot be below ${min}`)
    .refine((v) => parseNumber(v) <= max, `${label} cannot be above ${max.toLocaleString('en-ZA')}`)
    .refine(
      (v) => (v.split(/[.,]/)[1] ?? '').length <= decimals,
      `${label} can have at most ${decimals} decimals`,
    );

export const optionalDecimalField = (label: string, max = 2000, decimals = 1) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        v === '' ||
        (/^\d+([.,]\d+)?$/.test(v) &&
          parseNumber(v) >= 0 &&
          parseNumber(v) <= max &&
          (v.split(/[.,]/)[1] ?? '').length <= decimals),
      `${label} must be a number up to ${max}, or blank`,
    );

/** "" -> null, otherwise the number. */
export const toNullableNumber = (v: string): number | null =>
  v.trim() === '' ? null : parseNumber(v);
export const toNullableString = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/** True when sale < price, comparing in cents (used in cross-field refinements). */
export const saleBelowPrice = (price: string, sale: string): boolean =>
  sale.trim() === '' ||
  !MONEY.test(price.replace(',', '.')) ||
  toCents(parseNumber(sale)) < toCents(parseNumber(price));

export const numToField = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : String(n);

/** Latitude/longitude typed as text (may be negative). */
export const coordField = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (v) => /^-?\d+([.,]\d+)?$/.test(v) && Number.isFinite(parseNumber(v)),
      `${label} must be a number`,
    )
    .refine(
      (v) => parseNumber(v) >= min && parseNumber(v) <= max,
      `${label} must be between ${min} and ${max}`,
    );
