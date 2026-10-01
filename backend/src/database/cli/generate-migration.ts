import 'reflect-metadata';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFiles } from '../../config/load-env';
import { createDataSource, databaseSettingsFromEnv } from '../typeorm-options';
import { computeSchemaDiff } from './schema-diff';

const escapeForTemplate = (sql: string) =>
  sql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/**
 * `npm run migration:generate -- AddSomething`
 * Diffs the migrated database against the entities and writes a migration file plus its
 * registration in migrations/index.ts. ALWAYS review the generated SQL before committing.
 */
async function main(): Promise<void> {
  loadEnvFiles();
  const rawName = process.argv[2];
  if (!rawName || !/^[A-Za-z][A-Za-z0-9]*$/.test(rawName)) {
    throw new Error('Usage: npm run migration:generate -- <PascalCaseName>');
  }
  const dataSource = createDataSource(databaseSettingsFromEnv());
  await dataSource.initialize();
  try {
    const pending = await dataSource.showMigrations();
    if (pending) throw new Error('Run pending migrations first (npm run migration:run).');

    const diff = await computeSchemaDiff(dataSource);
    if (diff.up.length === 0) {
      console.log('No schema changes detected – nothing to generate.');
      return;
    }

    const timestamp = Date.now();
    const className = `${rawName}${timestamp}`;
    const fileBase = `${timestamp}-${rawName}`;
    const fmt = (qs: string[]) =>
      qs.map((q) => `    await queryRunner.query(\`${escapeForTemplate(q)}\`);`).join('\n');

    const source = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
${fmt(diff.up)}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${fmt(diff.down)}
  }
}
`;
    const dir = join(__dirname, '..', 'migrations');
    writeFileSync(join(dir, `${fileBase}.ts`), source);

    const indexPath = join(dir, 'index.ts');
    let index = readFileSync(indexPath, 'utf8');
    index = `import { ${className} } from './${fileBase}';\n${index}`;
    index = index.replace(/= \[([^\]]*)\];/, (_m, items: string) => {
      const list = items.trim() ? `${items.trim().replace(/,$/, '')}, ${className}` : className;
      return `= [${list}];`;
    });
    writeFileSync(indexPath, index);
    console.log(`Created src/database/migrations/${fileBase}.ts (${diff.up.length} statement(s)).`);
    if (!existsSync(indexPath)) throw new Error('index.ts missing');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
