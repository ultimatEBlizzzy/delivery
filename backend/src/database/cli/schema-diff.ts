import { DataSource } from 'typeorm';

/** Statements the schema builder would run to make the database match the entities. */
export interface SchemaDiff {
  up: string[];
  down: string[];
}

/**
 * Indexes created by hand-written SQL in migrations that TypeORM cannot express with decorators
 * (e.g. GIN trigram indexes). They carry this suffix so the diff ignores them.
 */
const MANUAL_INDEX_PATTERN = /INDEX\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:\w+\.)?"[^"]*_manual"/i;

/**
 * Compares the live database (after migrations) with what the entity decorators describe.
 * Used by the migration generator and by the schema-drift test that guards CI.
 */
export async function computeSchemaDiff(dataSource: DataSource): Promise<SchemaDiff> {
  const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();
  const keep = (q: { query: string }) => !isKnownFalsePositive(q.query);
  return {
    up: sqlInMemory.upQueries.filter(keep).map((q) => q.query),
    down: sqlInMemory.downQueries
      .filter(keep)
      .map((q) => q.query)
      .reverse(),
  };
}

function isKnownFalsePositive(query: string): boolean {
  // TypeORM re-normalises jsonb defaults ('{}'::jsonb) on every comparison.
  if (/SET DEFAULT '[^']*'::jsonb/i.test(query)) return true;
  if (/DROP DEFAULT/i.test(query) && /jsonb/i.test(query)) return true;
  if (MANUAL_INDEX_PATTERN.test(query)) return true;
  // PostGIS system tables are not ours.
  if (/spatial_ref_sys|geometry_columns|geography_columns/i.test(query)) return true;
  return false;
}
