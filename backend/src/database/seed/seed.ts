import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, Role } from '@hardware-delivery/shared';
import { loadEnvFiles } from '../../config/load-env';
import { seedCatalogue } from './seed-catalogue';

/**
 * Demo data. Fictional stores/people only (all e-mail addresses end in .test, a reserved TLD).
 *   npm run db:seed        seed an EMPTY database (does nothing if already seeded)
 *   npm run db:reset       wipe all data, then seed (keeps the schema)
 * Refuses to run when NODE_ENV=production unless --force is given.
 */
const args = new Set(process.argv.slice(2));

async function wipe(ds: DataSource): Promise<void> {
  await ds.query(`
    DO $$ DECLARE r record; BEGIN
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', 'roles', 'spatial_ref_sys')
      LOOP EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename); END LOOP;
    END $$;`);
}

async function main(): Promise<void> {
  loadEnvFiles();
  if (process.env.NODE_ENV === 'production' && !args.has('--force')) {
    throw new Error(
      'Refusing to seed demo data in production (it creates well-known demo passwords). Pass --force if you really mean it.',
    );
  }
  process.env.SCHEDULER_ENABLED = 'false'; // no background jobs while seeding
  const log = (m: string) => console.log(m);

  const { AppModule } = await import('../../app.module');
  const { AuthService } = await import('../../modules/auth/auth.service');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    const [{ n }] = (await ds.query(`SELECT COUNT(*)::int AS n FROM users`)) as Array<{
      n: number;
    }>;
    if (n > 0 && !args.has('--reset')) {
      log('Database already contains data – nothing to do. Use `npm run db:reset` to start over.');
      return;
    }
    if (args.has('--reset')) {
      log('Wiping existing data…');
      await wipe(ds);
    }

    log('Seeding demo data…');
    const auth = app.get(AuthService);
    await auth.createAccount(
      {
        email: DEMO_ACCOUNTS.ADMIN[0].email,
        password: DEMO_PASSWORD,
        firstName: 'Ada',
        lastName: 'Admin',
      },
      [Role.ADMIN],
    );
    log('  ✔ admin account');
    await seedCatalogue(app, log);

    log('\nDone. Sign in with any demo account – password for all of them: ' + DEMO_PASSWORD);
    log(`  admin     ${DEMO_ACCOUNTS.ADMIN[0].email}`);
    log(`  store     ${DEMO_ACCOUNTS.STORE.map((s) => s.email).join(', ')}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
