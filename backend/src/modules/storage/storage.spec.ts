import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../config';
import { detectFileType } from './file-type';
import { LocalStorageProvider } from './local-storage.provider';
import { StorageService } from './storage.service';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(16),
]);

describe('detectFileType (magic bytes, never the client-supplied type)', () => {
  it('recognises real images and PDFs', () => {
    expect(detectFileType(PNG)).toEqual({ mime: 'image/png', ext: 'png' });
    expect(detectFileType(JPEG)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(detectFileType(WEBP)).toEqual({ mime: 'image/webp', ext: 'webp' });
    expect(detectFileType(PDF)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
  });

  it('rejects scripts, SVG and executables pretending to be images', () => {
    expect(
      detectFileType(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      ),
    ).toBeNull();
    expect(detectFileType(Buffer.from('<?php system($_GET["c"]); ?>' + ' '.repeat(20)))).toBeNull();
    expect(detectFileType(Buffer.from('MZ' + '\u0000'.repeat(40)))).toBeNull();
    expect(detectFileType(Buffer.alloc(4))).toBeNull();
  });
});

describe('StorageService', () => {
  let dir: string;
  let service: StorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hd-storage-'));
    const env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://u:p@localhost/db',
      JWT_ACCESS_SECRET: 'j'.repeat(40),
      STORAGE_SIGNING_SECRET: 's'.repeat(40),
      UPLOAD_DIR: dir,
    };
    const loaded = loadConfig(env) as unknown as Record<string, unknown>;
    const cfg = { get: (key: string) => loaded[key] };
    service = new StorageService(new LocalStorageProvider(cfg as never), cfg as never);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const upload = (buffer: Buffer, name = 'x.png') => ({
    buffer,
    originalname: name,
    size: buffer.length,
    mimetype: 'image/png',
  });

  it('stores a valid image with a generated key and a public URL', async () => {
    const stored = await service.saveImage(upload(PNG), 'products');
    expect(stored.key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(stored.url).toBe(`/uploads/${stored.key}`);
    expect(stored.visibility).toBe('public');
    expect((await readdir(join(dir, 'public', 'products'))).length).toBe(1);
  });

  it('ignores the filename and client MIME type – only the real bytes count', async () => {
    await expect(
      service.saveImage(
        upload(Buffer.from('<script>alert(1)</script>'.padEnd(40)), 'photo.png'),
        'products',
      ),
    ).rejects.toThrow(/must be an image/);
    await expect(service.saveImage(upload(PDF, 'evil.png'), 'products')).rejects.toThrow(
      /must be an image/,
    );
    const stored = await service.saveImage(upload(PNG, 'totally-a-script.php'), 'products');
    expect(stored.key.endsWith('.png')).toBe(true);
  });

  it('enforces size limits and requires a file', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    await expect(service.saveImage(upload(big), 'products')).rejects.toThrow(/too large/);
    await expect(service.saveImage(undefined, 'products')).rejects.toThrow(/No file/);
  });

  it('keeps documents private and serves them only via signed URLs', async () => {
    const stored = await service.saveDocument(upload(PDF, 'licence.pdf'), 'driver-documents');
    expect(stored.visibility).toBe('private');
    expect(stored.url).toMatch(
      /^\/api\/v1\/files\/private\/driver-documents\/.+\.pdf\?exp=\d+&sig=/,
    );
    expect(await readdir(join(dir, 'private', 'driver-documents'))).toHaveLength(1);
    await expect(readdir(join(dir, 'public', 'driver-documents'))).rejects.toThrow();
  });

  it('signed URLs verify, expire and cannot be tampered with', () => {
    const key = 'driver-documents/abc.pdf';
    const url = new URL(service.signedUrl(key, 60), 'http://x');
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig')!;
    expect(service.verifySignature(key, exp, sig)).toBe(true);
    expect(service.verifySignature('driver-documents/other.pdf', exp, sig)).toBe(false); // different file
    expect(service.verifySignature(key, exp + 1000, sig)).toBe(false); // extended expiry
    expect(service.verifySignature(key, exp, `${sig.slice(0, -2)}xx`)).toBe(false); // forged signature
    expect(service.verifySignature(key, exp, '')).toBe(false);
    const expired = new URL(service.signedUrl(key, -10), 'http://x');
    expect(
      service.verifySignature(
        key,
        Number(expired.searchParams.get('exp')),
        expired.searchParams.get('sig')!,
      ),
    ).toBe(false);
  });

  it('refuses unsafe keys (path traversal)', async () => {
    await expect(service.saveTrusted('../../etc/passwd.png', PNG, 'image/png')).rejects.toThrow(
      /Unsafe storage key/,
    );
    await expect(service.saveTrusted('products/../../x.png', PNG, 'image/png')).rejects.toThrow(
      /Unsafe storage key/,
    );
    expect(await service.open('../../etc/passwd', 'public')).toBeNull();
  });
});
