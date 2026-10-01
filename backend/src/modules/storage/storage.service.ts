import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  API_PREFIX,
  DOCUMENT_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
} from '@hardware-delivery/shared';
import { AppConfig } from '../../config';
import { detectFileType } from './file-type';
import { FileVisibility, STORAGE_PROVIDER, StorageProvider, StoredFile } from './storage.types';

export interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
  size: number;
  mimetype?: string;
}

/**
 * Validates and stores uploads and produces URLs for them. Controllers never touch the disk (or
 * S3) directly, so swapping the provider needs no controller changes.
 */
@Injectable()
export class StorageService {
  private readonly secret: string;
  private readonly signedUrlTtl: number;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
    config: ConfigService<AppConfig, true>,
  ) {
    const storage = config.get('storage', { infer: true });
    this.secret = storage.signingSecret;
    this.signedUrlTtl = storage.signedUrlTtlSeconds;
  }

  /** Public image (product photo, store logo…). Rejects anything that is not really a JPEG/PNG/WebP. */
  async saveImage(file: UploadedFile | undefined, folder: string): Promise<StoredFile> {
    return this.saveValidated(
      file,
      folder,
      'public',
      IMAGE_MIME_TYPES as readonly string[],
      MAX_IMAGE_BYTES,
      'an image (JPEG, PNG or WebP)',
    );
  }

  /** Private image or PDF (driver documents, proof of delivery). Served only through signed URLs. */
  async saveDocument(file: UploadedFile | undefined, folder: string): Promise<StoredFile> {
    return this.saveValidated(
      file,
      folder,
      'private',
      DOCUMENT_MIME_TYPES as readonly string[],
      MAX_DOCUMENT_BYTES,
      'an image or PDF',
    );
  }

  /** Private image (e.g. delivery photos) – same validation as public images but not publicly served. */
  async savePrivateImage(file: UploadedFile | undefined, folder: string): Promise<StoredFile> {
    return this.saveValidated(
      file,
      folder,
      'private',
      IMAGE_MIME_TYPES as readonly string[],
      MAX_IMAGE_BYTES,
      'an image (JPEG, PNG or WebP)',
    );
  }

  /** Stores trusted, server-generated content (seed data, generated SVGs). Not for user uploads. */
  async saveTrusted(
    key: string,
    body: Buffer,
    contentType: string,
    visibility: FileVisibility = 'public',
  ): Promise<StoredFile> {
    await this.provider.put({ key, body, contentType, visibility });
    return { key, visibility, url: this.urlFor(key, visibility), contentType, size: body.length };
  }

  private async saveValidated(
    file: UploadedFile | undefined,
    folder: string,
    visibility: FileVisibility,
    allowed: readonly string[],
    maxBytes: number,
    description: string,
  ): Promise<StoredFile> {
    if (visibility === 'private' && folder.includes('/')) {
      throw new Error(
        'Private folders must be a single path segment (they are served by /files/private/:folder/:name)',
      );
    }
    if (!file?.buffer?.length) throw new BadRequestException('No file was uploaded');
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `File is too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB)`,
      );
    }
    const detected = detectFileType(file.buffer);
    if (!detected || !allowed.includes(detected.mime)) {
      throw new BadRequestException(`The file must be ${description}`);
    }
    const key = `${folder}/${randomUUID()}.${detected.ext}`;
    await this.provider.put({ key, body: file.buffer, contentType: detected.mime, visibility });
    return {
      key,
      visibility,
      url: this.urlFor(key, visibility),
      contentType: detected.mime,
      size: file.size,
    };
  }

  async delete(
    key: string | null | undefined,
    visibility: FileVisibility = 'public',
  ): Promise<void> {
    if (key) await this.provider.delete(key, visibility);
  }

  open(key: string, visibility: FileVisibility) {
    return this.provider.open(key, visibility);
  }

  urlFor(key: string, visibility: FileVisibility): string {
    return visibility === 'public' ? this.provider.publicUrl(key) : this.signedUrl(key);
  }

  /** Short-lived URL for a private file. Anyone holding the link can fetch it until it expires. */
  signedUrl(key: string, ttlSeconds = this.signedUrlTtl): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/${API_PREFIX}/files/private/${key}?exp=${exp}&sig=${this.sign(key, exp)}`;
  }

  verifySignature(key: string, exp: number, signature: string): boolean {
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(key, exp));
    const given = Buffer.from(signature ?? '');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(key: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${key}:${exp}`).digest('base64url');
  }
}
