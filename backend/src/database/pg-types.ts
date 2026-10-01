import { types } from 'pg';

/**
 * Parse BIGINT (COUNT/SUM results) and NUMERIC (money, SUM(numeric)) into JS numbers.
 * Safe here: counts are far below 2^53 and money columns are NUMERIC(12,2).
 * Imported once at process start (app bootstrap and CLI scripts).
 */
let configured = false;
export function configurePgTypes(): void {
  if (configured) return;
  configured = true;
  types.setTypeParser(types.builtins.INT8, (v: string) => Number.parseInt(v, 10));
  types.setTypeParser(types.builtins.NUMERIC, (v: string) => Number.parseFloat(v));
}
configurePgTypes();
