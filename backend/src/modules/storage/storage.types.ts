import type { Readable } from 'node:stream';

export type FileVisibility = 'public' | 'private';

export interface PutFileInput {
  key: string;
  body: Buffer;
  contentType: string;
  visibility: FileVisibility;
}

export interface StoredFile {
  key: string;
  visibility: FileVisibility;
  /** Browser-usable URL (public URL, or a short-lived signed URL for private files). */
  url: string;
  contentType: string;
  size: number;
}

/**
 * Where files physically live. The default implementation writes to local disk; an S3/GCS
 * implementation only needs to implement this interface (see docs/ARCHITECTURE.md).
 */
export interface StorageProvider {
  readonly name: string;
  put(input: PutFileInput): Promise<void>;
  delete(key: string, visibility: FileVisibility): Promise<void>;
  /** Opens a stored file for streaming (used to serve private files through the API). */
  open(key: string, visibility: FileVisibility): Promise<{ stream: Readable; size: number } | null>;
  /** URL for files in the public area. */
  publicUrl(key: string): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
