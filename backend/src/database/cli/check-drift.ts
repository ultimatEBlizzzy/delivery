import 'reflect-metadata';
import { loadEnvFiles } from '../../config/load-env';
import { createDataSource, databaseSettingsFromEnv } from '../typeorm-options';
import { computeSchemaDiff } from './schema-diff';

/**
 * `npm run migration:check` – fails when entities and migrations disagree, i.e. someone changed an
 * entity without generating a migration. Run it against a database that is fully migrated.
 */
async function main(): Promise<void> {
  loadEnvFiles();
  const dataSource = createDataSource(databaseSettingsFromEnv());
  await dataSource.initialize();
  try {
    const diff = await computeSchemaDiff(dataSource);
    if (diff.up.length === 0) {
      console.log('✔ Entities and migrations are in sync.');
      return;
    }
    console.error('✖ Schema drift detected. These statements are missing from migrations:\n');
    diff.up.forEach((q) => console.error(`  ${q}`));
    console.error('\nRun `npm run migration:generate -- <Name>` to create the migration.');
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
