import { Link } from 'react-router-dom';
import { env } from '@/env';
import { cn } from '@/lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} role="img" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#ea580c" />
      <path d="M14 40h24v-4h8l6 6v6H46a5 5 0 0 1-10 0H28a5 5 0 0 1-10 0h-4V40Z" fill="#fff" />
      <path d="M16 18h20v18H16z" fill="#fff" opacity=".9" />
      <circle cx="23" cy="48" r="3" fill="#ea580c" />
      <circle cx="41" cy="48" r="3" fill="#ea580c" />
    </svg>
  );
}

export function Brand({
  to = '/',
  suffix,
  className,
  light,
}: {
  to?: string;
  suffix?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn('flex items-center gap-2.5 rounded-lg', className)}
      aria-label={`${env.appName} home`}
    >
      <BrandMark />
      <span
        className={cn(
          'text-lg font-extrabold tracking-tight',
          light ? 'text-white' : 'text-slate-900',
        )}
      >
        {env.appName}
        {suffix && (
          <span className="ml-1.5 text-xs font-semibold uppercase tracking-wider text-brand-500">
            {suffix}
          </span>
        )}
      </span>
    </Link>
  );
}
