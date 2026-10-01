import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_REGEX, Role } from '@hardware-delivery/shared';
import { AppModule } from '../../app.module';
import { loadEnvFiles } from '../../config/load-env';
import { AuthService } from '../../modules/auth/auth.service';
import { UsersService } from '../../modules/users/users.service';

/**
 * Creates (or promotes) a platform administrator. This is how the first admin is created in a
 * real deployment where the demo seed is never run.
 *
 *   npm run admin:create -- --email owner@example.com --password 'S3cure-passw0rd' --first Ada --last Admin
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run admin:create           (non-interactive / containers)
 */
function arg(name: string, envName: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return (i !== -1 ? process.argv[i + 1] : undefined) ?? process.env[envName] ?? fallback;
}

async function main(): Promise<void> {
  loadEnvFiles();
  const email = arg('email', 'ADMIN_EMAIL')?.trim().toLowerCase();
  const password = arg('password', 'ADMIN_PASSWORD');
  const firstName = arg('first', 'ADMIN_FIRST_NAME', 'Platform');
  const lastName = arg('last', 'ADMIN_LAST_NAME', 'Admin');
  if (!email || !password) {
    throw new Error(
      'Usage: npm run admin:create -- --email <email> --password <password> [--first <name>] [--last <name>]',
    );
  }
  if (!PASSWORD_REGEX.test(password) || password.length < 8)
    throw new Error(PASSWORD_POLICY_MESSAGE);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const users = app.get(UsersService);
    const existing = await users.findByEmailWithPassword(email);
    if (existing) {
      await users.addRole(existing.id, Role.ADMIN);
      console.log(`✔ Existing user ${email} now has the ADMIN role (password unchanged).`);
    } else {
      await app
        .get(AuthService)
        .createAccount({ email, password, firstName: firstName!, lastName: lastName! }, [
          Role.ADMIN,
        ]);
      console.log(`✔ Created administrator ${email}.`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
