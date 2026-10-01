import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';

/**
 * Loads `.env` for scripts that run outside Nest (migrations, seeds, CLI).
 * Looks in the current directory and the monorepo root; real environment variables win.
 */
export function loadEnvFiles(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
  for (const file of candidates) {
    if (existsSync(file)) dotenv.config({ path: file, quiet: true });
  }
}

/** Paths handed to @nestjs/config (it keeps the first value found for each variable). */
export const ENV_FILE_PATHS = ['.env', '../.env'];
