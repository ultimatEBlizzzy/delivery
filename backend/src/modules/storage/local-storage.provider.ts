import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { AppConfig } from '../../config';
import { FileVisibility, PutFileInput, StorageProvider } from './storage.types';

/** Keys we generate look like "folder/uuid.ext" – reject anything else (path traversal defence). */
const SAFE_KEY = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*\/[a-zA-Z0-9-]+\.[a-z0-9]{2,5}$/;

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly logger = new Logger('Storage');
  private readonly root: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.root = resolve(config.get('storage', { infer: true }).uploadDir);
  }

  private pathFor(key: string, visibility: FileVisibility): string {
    if (!SAFE_KEY.test(key)) throw new Error(`Unsafe storage key: ${key}`);
    const base = join(this.root, visibility);
    const full = resolve(base, key);
    if (!full.startsWith(base + sep))
      throw new Error(`Storage key escapes the upload directory: ${key}`);
    return full;
  }

  async put({ key, body, visibility }: PutFileInput): Promise<void> {
    const path = this.pathFor(key, visibility);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'w' });
  }

  async delete(key: string, visibility: FileVisibility): Promise<void> {
    try {
      await rm(this.pathFor(key, visibility), { force: true });
    } catch (err) {
      this.logger.warn(`Could not delete ${visibility}/${key}: ${(err as Error).message}`);
    }
  }

  async open(key: string, visibility: FileVisibility) {
    let path: string;
    try {
      path = this.pathFor(key, visibility);
    } catch {
      return null;
    }
    try {
      const info = await stat(path);
      if (!info.isFile()) return null;
      return { stream: createReadStream(path), size: info.size };
    } catch {
      return null;
    }
  }

  /** Public files are served by Express static middleware at /uploads (same origin as the SPA via the proxy). */
  publicUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
