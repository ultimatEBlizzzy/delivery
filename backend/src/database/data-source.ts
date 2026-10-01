import { loadEnvFiles } from '../config/load-env';
import { createDataSource, databaseSettingsFromEnv } from './typeorm-options';

/**
 * Entry point for the TypeORM CLI (`npm run typeorm -- migration:show` etc.).
 * Application code uses the DataSource created by DatabaseModule instead.
 */
loadEnvFiles();
export default createDataSource(databaseSettingsFromEnv());
