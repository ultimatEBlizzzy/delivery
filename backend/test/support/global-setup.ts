import { ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { loadEnvFiles } from '../../src/config/load-env';
import { createDataSource } from '../../src/database/typeorm-options';

declare global {
  var __EMBEDDED_DB__: ChildProcess | undefined;
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => res(port));
    });
  });
}

/** Starts the Docker-free PostGIS database used when TEST_DATABASE_URL is not provided. */
async function startEmbeddedDatabase(): Promise<string> {
  const port = await freePort();
  const script = resolve(__dirname, '../../scripts/embedded-db.mjs');
  const child = spawn(process.execPath, [script, '--memory', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  globalThis.__EMBEDDED_DB__ = child;
  await new Promise<void>((res, rej) => {
    const timer = setTimeout(
      () => rej(new Error('Embedded database did not start within 120s')),
      120_000,
    );
    child.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('listening on')) {
        clearTimeout(timer);
        res();
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => process.stderr.write(`[embedded-db] ${chunk}`));
    child.once('exit', (code) => rej(new Error(`Embedded database exited early (code ${code})`)));
  });
  return `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
}

export default async function globalSetup(): Promise<void> {
  loadEnvFiles();
  let url = process.env.TEST_DATABASE_URL?.trim();
  let wipe = false;

  if (url) {
    // SAFETY: the schema is dropped before the run – only ever do that to a dedicated test database.
    const dbName = new URL(url).pathname.replace(/^\//, '');
    if (!/test/i.test(dbName)) {
      throw new Error(
        `Refusing to wipe database "${dbName}": TEST_DATABASE_URL must point to a database whose name contains "test".`,
      );
    }
    wipe = true;
  } else {
    url = await startEmbeddedDatabase();
    // The embedded database is ONE session shared by every connection, so connections must not be
    // pooled in parallel (their protocol messages would interleave). Real PostgreSQL has no such limit.
    process.env.DATABASE_POOL_MAX ??= '1';
  }

  const dataSource = createDataSource({ url, poolMax: 2 });
  try {
    await dataSource.initialize();
  } catch (err) {
    const host = new URL(url).host;
    throw new Error(
      `Could not connect to the test database at ${host}: ${(err as Error).message || err}\n` +
        'Start it (docker compose up -d db) or unset TEST_DATABASE_URL to use the embedded database.',
      { cause: err },
    );
  }
  try {
    if (wipe) {
      await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
      await dataSource.query('CREATE SCHEMA public');
    }
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
  process.env.DATABASE_URL = url;
}
