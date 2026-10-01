#!/usr/bin/env node
/**
 * Docker-free PostgreSQL + PostGIS for local development and test runs.
 *
 * Starts PGlite (PostgreSQL compiled to WebAssembly) with the PostGIS extension and exposes it over the
 * normal PostgreSQL wire protocol, so the API, TypeORM and psql connect exactly as they would to a real
 * server. It is a convenience for machines without Docker – use the docker-compose `db` service
 * (postgis/postgis) for anything resembling production.
 *
 * Usage:  node scripts/embedded-db.mjs [--port 54329] [--host 127.0.0.1] [--data <dir>] [--memory]
 *   --data    persist to this directory (default: <repo root>/.pglite-data)
 *   --memory  keep everything in RAM (data is lost on exit)
 *
 * Connection string:  postgresql://postgres:postgres@127.0.0.1:<port>/postgres
 *
 * HOW CONNECTIONS ARE SHARED
 * PGlite is ONE PostgreSQL session. The stock `@electric-sql/pglite-socket` feeds it one protocol message
 * at a time, which breaks when several clients connect (their Parse/Bind/Execute messages interleave) and
 * after any error (PGlite then emits two ReadyForQuery messages, shifting every later response by one).
 * This server therefore:
 *   1. frames the stream and forwards whole cycles (…up to Sync, or a simple Query) in one call;
 *   2. serialises cycles with a session lock that a connection KEEPS while it is inside a transaction;
 *   3. collapses the duplicate ReadyForQuery;
 *   4. rolls back an abandoned transaction when its connection drops;
 *   5. fails a waiting request with SQLSTATE 55P03 instead of hanging if the lock is held for too long.
 * Consequence: transactions from different connections run one after another (real PostgreSQL runs them in
 * parallel with row-level locks). Code must not use a second connection while it holds a transaction open.
 */
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';

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
const LOCK_WAIT_MS = Number(process.env.EMBEDDED_DB_LOCK_WAIT_MS ?? 30_000);
const DEBUG = process.env.EMBEDDED_DB_DEBUG === '1';

const db = await PGlite.create({ dataDir, extensions: { postgis } });
await db.exec('CREATE EXTENSION IF NOT EXISTS postgis;');
const { rows } = await db.query('SELECT postgis_version() AS postgis, current_setting($1) AS pg', ['server_version']);

// ---- protocol helpers -------------------------------------------------------------------------------
const SSL_REQUEST = 80877103;
const CANCEL_REQUEST = 80877102;
const PROTOCOL_V3 = 196608;

/** ErrorResponse + ReadyForQuery for failures raised by this server itself. */
function errorResponse(code, message) {
  const field = (type, value) => Buffer.concat([Buffer.from(type), Buffer.from(value + '\0')]);
  const body = Buffer.concat([field('S', 'ERROR'), field('V', 'ERROR'), field('C', code), field('M', message), Buffer.from('\0')]);
  const err = Buffer.alloc(5);
  err.write('E');
  err.writeInt32BE(body.length + 4, 1);
  const rfq = Buffer.from([0x5a, 0, 0, 0, 5, 0x49]); // Z, len 5, 'I'
  return Buffer.concat([err, body, rfq]);
}

/**
 * Removes a ReadyForQuery that is immediately followed by another one (PGlite emits two after an error in
 * the extended protocol). Returns the cleaned buffer and the transaction status of the final ReadyForQuery.
 */
function normaliseResponse(buffer) {
  const parts = [];
  let status = null;
  let offset = 0;
  while (offset + 5 <= buffer.length) {
    const type = buffer[offset];
    const length = buffer.readInt32BE(offset + 1);
    const end = offset + 1 + length;
    if (end > buffer.length) break;
    const next = end + 5 <= buffer.length ? buffer[end] : null;
    const isRfq = type === 0x5a;
    if (isRfq) status = String.fromCharCode(buffer[offset + 5]);
    if (!(isRfq && next === 0x5a)) parts.push(buffer.subarray(offset, end));
    offset = end;
  }
  return { data: Buffer.concat(parts), status };
}

// ---- session lock ------------------------------------------------------------------------------------
class SessionLock {
  owner = null;
  waiters = [];

  async acquire(conn) {
    if (this.owner === conn) return true;
    if (this.owner === null) {
      this.owner = conn;
      return true;
    }
    return new Promise((resolveWaiter) => {
      const waiter = { conn, resolve: resolveWaiter, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolveWaiter(false);
      }, LOCK_WAIT_MS);
      this.waiters.push(waiter);
    });
  }

  release(conn) {
    if (this.owner !== conn) return;
    this.owner = null;
    const next = this.waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      this.owner = next.conn;
      next.resolve(true);
    }
  }

  forget(conn) {
    this.waiters = this.waiters.filter((w) => {
      if (w.conn !== conn) return true;
      clearTimeout(w.timer);
      w.resolve(false);
      return false;
    });
  }
}

const lock = new SessionLock();
let nextConnId = 1;

async function run(buffer) {
  return db.runExclusive(async () => Buffer.from(await db.execProtocolRaw(buffer)));
}

// ---- connection handling -----------------------------------------------------------------------------
const server = createServer((socket) => {
  const conn = { id: nextConnId++, inTransaction: false };
  let buffer = Buffer.alloc(0);
  let started = false;
  let batch = [];
  let busy = Promise.resolve(); // processes this connection's cycles strictly in order
  let closed = false;
  socket.setNoDelay(true);

  const log = (...a) => DEBUG && console.log(`[conn ${conn.id}]`, ...a);

  async function execute(messages) {
    if (closed) return;
    const acquired = await lock.acquire(conn);
    if (!acquired) {
      if (!closed) socket.write(errorResponse('55P03', 'embedded database busy: another connection has held a transaction open too long'));
      return;
    }
    let response;
    try {
      response = await run(Buffer.concat(messages));
    } catch (err) {
      log('execProtocolRaw failed', err);
      if (!closed) socket.write(errorResponse('XX000', `embedded database error: ${err.message}`));
      lock.release(conn);
      conn.inTransaction = false;
      return;
    }
    const { data, status } = normaliseResponse(response);
    conn.inTransaction = status === 'T' || status === 'E';
    if (!conn.inTransaction) lock.release(conn); // idle again: let other connections in
    if (!closed && data.length) socket.write(data);
  }

  function enqueue(messages) {
    busy = busy.then(() => execute(messages)).catch((err) => log('cycle failed', err));
  }

  function pump() {
    while (buffer.length >= 4) {
      if (!started) {
        // Startup-phase messages have no type byte: Int32 length + Int32 code.
        const length = buffer.readInt32BE(0);
        if (buffer.length < 8) return;
        const code = buffer.readInt32BE(4);
        if (code === SSL_REQUEST) {
          socket.write('N'); // no TLS on the embedded server
          buffer = buffer.subarray(8);
          continue;
        }
        if (code === CANCEL_REQUEST) {
          buffer = buffer.subarray(Math.max(length, 16));
          continue;
        }
        if (buffer.length < length) return;
        const startup = buffer.subarray(0, length);
        buffer = buffer.subarray(length);
        if (code !== PROTOCOL_V3) {
          socket.write(errorResponse('0A000', 'unsupported frontend protocol'));
          socket.end();
          return;
        }
        started = true;
        enqueue([startup]); // PGlite answers with AuthenticationOk, parameters, BackendKeyData, ReadyForQuery
        continue;
      }
      if (buffer.length < 5) return;
      const type = buffer[0];
      const length = buffer.readInt32BE(1);
      if (buffer.length < 1 + length) return;
      const message = buffer.subarray(0, 1 + length);
      buffer = buffer.subarray(1 + length);
      if (type === 0x58 /* Terminate */) {
        socket.end();
        return;
      }
      batch.push(message);
      // A cycle ends at Sync (extended protocol) or after a simple Query; Flush also asks for output.
      if (type === 0x53 /* S */ || type === 0x51 /* Q */ || type === 0x48 /* H */) {
        enqueue(batch);
        batch = [];
      }
    }
  }

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    pump();
  });

  const cleanup = () => {
    if (closed) return;
    closed = true;
    lock.forget(conn);
    busy = busy.then(async () => {
      if (lock.owner === conn) {
        // The client vanished mid-transaction: undo it so the next connection starts clean.
        try {
          await db.exec('ROLLBACK'); // public PGlite methods take the exclusive lock themselves
        } catch (err) {
          log('rollback on disconnect failed', err);
        }
        lock.release(conn);
      }
    });
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(port, host, resolveListen);
});

const actualPort = server.address().port;
console.log(`embedded-db listening on ${host}:${actualPort}`);
console.log(`PostgreSQL ${rows[0].pg} with PostGIS ${rows[0].postgis}`);
console.log(`storage: ${inMemory ? 'memory (ephemeral)' : dataDir}`);
console.log(`DATABASE_URL=postgresql://postgres:postgres@${host}:${actualPort}/postgres`);
console.log('NOTE: transactions from different connections are serialised (single PGlite session).');

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.close();
  try {
    await db.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
