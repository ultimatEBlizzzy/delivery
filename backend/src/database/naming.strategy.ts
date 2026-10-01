import { createHash } from 'node:crypto';
import { DefaultNamingStrategy, NamingStrategyInterface, Table, View } from 'typeorm';

const MAX_IDENTIFIER = 63; // PostgreSQL silently truncates longer identifiers, which breaks schema diffing

function snake(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[\s.-]+/g, '_')
    .toLowerCase();
}

function bounded(name: string): string {
  if (name.length <= MAX_IDENTIFIER) return name;
  const hash = createHash('sha1').update(name).digest('hex').slice(0, 8);
  return `${name.slice(0, MAX_IDENTIFIER - 9)}_${hash}`;
}

/**
 * snake_case columns and deterministic, human-readable constraint/index names
 * (`fk_orders_store_id`, `idx_orders_created_at`, `uq_users_email`, …).
 *
 * Readable names make hand-written SQL in migrations and EXPLAIN output much easier to follow,
 * and they are stable so the schema-drift check never reports false positives.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snake(targetName);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return snake([...embeddedPrefixes, customName ?? propertyName].join('_'));
  }

  relationName(propertyName: string): string {
    return snake(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(first: string, second: string, firstProperty: string): string {
    return snake(`${first}_${firstProperty}_${second}`);
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snake(`${tableName}_${columnName ?? propertyName}`);
  }

  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    void columnNames;
    return bounded(`pk_${this.getTableName(tableOrName)}`);
  }

  uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    return bounded(`uq_${this.getTableName(tableOrName)}_${[...columnNames].sort().join('_')}`);
  }

  relationConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    return bounded(`rel_${this.getTableName(tableOrName)}_${[...columnNames].sort().join('_')}`);
  }

  defaultConstraintName(tableOrName: Table | string, columnName: string): string {
    return bounded(`df_${this.getTableName(tableOrName)}_${columnName}`);
  }

  foreignKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return bounded(`fk_${this.getTableName(tableOrName)}_${[...columnNames].sort().join('_')}`);
  }

  indexName(tableOrName: Table | View | string, columns: string[]): string {
    const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
    return bounded(`idx_${table.split('.').pop()}_${[...columns].sort().join('_')}`);
  }

  checkConstraintName(tableOrName: Table | string, expression: string): string {
    const hash = createHash('sha1').update(expression).digest('hex').slice(0, 10);
    return bounded(`chk_${this.getTableName(tableOrName)}_${hash}`);
  }
}
