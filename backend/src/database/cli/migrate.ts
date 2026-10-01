import 'reflect-metadata';
import { loadEnvFiles } from '../../config/load-env';
import { createDataSource, databaseSettingsFromEnv } from '../typeorm-options';

/** `npm run migration:run` applies pending migrations; `... revert` undoes the latest one. */
async function main(): Promise<void> {
  loadEnvFiles();
  const dataSource = createDataSource(databaseSettingsFromEnv());
  await dataSource.initialize();
  try {
    if (process.argv[2] === 'revert') {
      await dataSource.undoLastMigration({ transaction: 'each' });
      console.log('Reverted the latest migration.');
    } else {
      const applied = await dataSource.runMigrations({ transaction: 'each' });
      console.log(
        applied.length
          ? `Applied ${applied.length} migration(s):\n${applied.map((m) => `  ✔ ${m.name}`).join('\n')}`
          : 'Database is up to date.',
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
