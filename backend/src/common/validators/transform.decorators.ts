import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { normalizeSaPhone, SA_PHONE_MESSAGE } from '@hardware-delivery/shared';

/** Trims surrounding whitespace of string input. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Trims and lower-cases (emails, codes). */
export const TrimLower = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Trims, upper-cases (discount codes, registration plates). */
export const TrimUpper = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

/**
 * South African phone number. Accepts "082 123 4567", "0821234567", "+27821234567" and stores the
 * E.164 form (+27821234567).
 */
export const IsSaPhone = () =>
  applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? (normalizeSaPhone(value) ?? value.trim()) : value,
    ),
    Matches(/^\+27[1-8]\d{8}$/, { message: SA_PHONE_MESSAGE }),
  );

/** "true"/"false" query-string values to booleans. */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1') return true;
    if (value === 'false' || value === false || value === '0') return false;
    return value;
  });
