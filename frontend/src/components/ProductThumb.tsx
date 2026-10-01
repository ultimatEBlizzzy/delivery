import { Package } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Product photo with a graceful fallback when there is no image or it fails to load. */
export function ProductThumb({
  src,
  alt = '',
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400',
        className ?? 'size-12',
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <Package className="size-1/2" aria-hidden />
      )}
    </span>
  );
}
