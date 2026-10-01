import { ValueTransformer } from 'typeorm';

/**
 * NUMERIC columns come back from node-postgres as strings (to preserve precision).
 * Money and measurement columns are small enough for IEEE doubles, so convert on read.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) =>
    value === null || value === undefined ? value : Number(value),
};
