import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' };
  return src ? (
    <img src={src} alt="" className={cn('rounded-full object-cover', dims[size], className)} />
  ) : (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        dims[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
