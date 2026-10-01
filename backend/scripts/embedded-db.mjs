#!/usr/bin/env node
/**
 * Docker-free PostgreSQL + PostGIS for local development and CI smoke runs.
 *
 * Starts PGlite (PostgreSQL compiled to WebAssembly) with the PostGIS extension and exposes it over
 * the normal PostgreSQL wire protocol, so the app, TypeORM and psql connect exactly as they would to
 * a real server. This is a convenience for machines without Docker – use the docker-compose
 * `db` service (postgis/postgis) for anything resembling production.
 *
 * Usage:  node scripts/embedded-db.mjs [--port 54329] [--host 127.0.0.1] [--data ./.pglite-data] [--memory]
 *   --data    persist to this directory (default: <repo root>/.pglite-data)
 *   --memory  keep everything in RAM (data is lost on exit)
 *
 * Connection string:  postgresql://postgres:postgres@127.0.0.1:<port>/postgres
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const host = String(flag('host', '127.0.0.1'));
const port = Number(flag('port', 54329));
const inMemory = flag('memory', false) === true;
// Default: <repo root>/.pglite-data, regardless of the directory the script is started from.
const defaultDataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../.pglite-data');
const dataDir = inMemory ? 'memory://' : resolve(String(flag('data', defaultDataDir)));
if (!inMemory) mkdirSync(dataDir, { recursive: true });

const db = await PGlite.create({ dataDir, extensions: { postgis } });
await db.exec('CREATE EXTENSION IF NOT EXISTS postgis;');
const { rows } = await db.query('SELECT postgis_version() AS postgis, current_setting($1) AS pg', ['server_version']);

const server = new PGLiteSocketServer({ db, host, port, maxConnections: 20 });
await server.start();

const actualPort = server.server?.address?.()?.port ?? port;
console.log(`embedded-db listening on ${host}:${actualPort}`);
console.log(`PostgreSQL ${rows[0].pg} with PostGIS ${rows[0].postgis}`);
console.log(`storage: ${inMemory ? 'memory (ephemeral)' : dataDir}`);
console.log(`DATABASE_URL=postgresql://postgres:postgres@${host}:${actualPort}/postgres`);
console.log('IMPORTANT: this embedded database is a single session shared by all connections.');
console.log('           Set DATABASE_POOL_MAX=1 in .env so the API uses one connection (see README).');

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  try {
    await server.stop();
    await db.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
