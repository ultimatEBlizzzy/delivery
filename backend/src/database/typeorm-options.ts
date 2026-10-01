import 'reflect-metadata';
import './pg-types';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { ALL_MIGRATIONS } from './migrations';
import { SnakeNamingStrategy } from './naming.strategy';

export interface DatabaseSettings {
  url: string;
  poolMax?: number;
  ssl?: boolean;
  logging?: boolean;
  runMigrationsOnStart?: boolean;
}

export function buildDataSourceOptions(db: DatabaseSettings): DataSourceOptions {
  return {
    type: 'postgres',
    url: db.url,
    entities: ALL_ENTITIES,
    migrations: ALL_MIGRATIONS,
    migrationsTableName: 'schema_migrations',
    migrationsRun: db.runMigrationsOnStart ?? false,
    synchronize: false, // schema changes ONLY through migrations
    namingStrategy: new SnakeNamingStrategy(),
    // Primary keys default to gen_random_uuid() (built into PostgreSQL 13+), no extension needed.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    ssl: db.ssl
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
    // Failed queries are always logged (except in tests, where assertions report them) – SQL text is
    // logged only when DATABASE_LOGGING=true.
    logging: db.logging
      ? ['query', 'error', 'warn']
      : process.env.NODE_ENV === 'test'
        ? false
        : ['error', 'warn'],
    applicationName: 'hardware-delivery-api',
    extra: {
      max: db.poolMax ?? 10,
      // Fail fast when the pool is exhausted instead of queueing requests forever.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    },
  };
}

export function createDataSource(db: DatabaseSettings): DataSource {
  return new DataSource(buildDataSourceOptions(db));
}

/** Reads DATABASE_* variables directly (migrations/seeds must not require unrelated secrets). */
export function databaseSettingsFromEnv(env: NodeJS.ProcessEnv = process.env): DatabaseSettings {
  const url = env.DATABASE_URL?.trim();
  if (!url)
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and review the values.');
  return {
    url,
    poolMax: env.DATABASE_POOL_MAX ? Number(env.DATABASE_POOL_MAX) : 10,
    ssl: env.DATABASE_SSL === 'true',
    logging: env.DATABASE_LOGGING === 'true',
  };
}
