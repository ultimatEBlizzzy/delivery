import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { MAX_IMAGE_BYTES } from '@hardware-delivery/shared';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/cn';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Pick-and-upload control with preview. Validation here is only for fast feedback – the API re-checks
 * the file's real type (magic bytes) and size.
 */
export function ImageUpload({
  label,
  imageUrl,
  onUpload,
  onRemove,
  shape = 'square',
  hint = 'JPEG, PNG or WebP, up to 5 MB.',
  className,
}: {
  label: string;
  imageUrl?: string | null;
  onUpload: (file: File) => Promise<unknown>;
  onRemove?: () => Promise<unknown>;
  shape?: 'square' | 'banner';
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ACCEPT.split(',').includes(file.type))
      return setError('Please choose a JPEG, PNG or WebP image.');
    if (file.size > MAX_IMAGE_BYTES) return setError('That image is larger than 5 MB.');
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400',
            shape === 'square' ? 'size-24' : 'h-24 w-48',
          )}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-7" aria-hidden />
          )}
          {busy && (
            <span
              className="absolute inset-0 flex items-center justify-center bg-white/70"
              role="status"
            >
              <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden />
              <span className="sr-only">Uploading</span>
            </span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label={`${label}: choose a file`}
            onChange={(e) => void handle(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {imageUrl ? 'Replace' : 'Upload'}
            </Button>
            {imageUrl && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                leftIcon={<Trash2 className="size-4" aria-hidden />}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onRemove();
                  } catch (err) {
                    setError(getErrorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">{hint}</p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
