import { Global, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfig } from '../config';
import { buildDataSourceOptions } from './typeorm-options';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildDataSourceOptions(config.get('database', { infer: true })),
    }),
  ],
})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('Database');

  constructor(private readonly dataSource: DataSource) {}

  /** Fail loudly (but not fatally) when the database has not been prepared. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const rows = (await this.dataSource.query('SELECT PostGIS_Version() AS v')) as Array<{
        v: string;
      }>;
      this.logger.log(`Connected. PostGIS ${rows[0]?.v?.split(' ')[0]}`);
    } catch {
      this.logger.error(
        'PostGIS is not available in this database. Use a PostGIS-enabled server (e.g. the postgis/postgis image) ' +
          'and run the migrations: `npm run db:migrate`.',
      );
    }
    const pending = await this.dataSource.showMigrations().catch(() => true);
    if (pending)
      this.logger.warn('There are pending database migrations. Run `npm run db:migrate`.');
  }
}
