import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
  titleForDocument,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
  titleForDocument?: string;
}) {
  useDocumentTitle(titleForDocument ?? title);
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div
            className={cn(
              'mb-1.5',
              typeof eyebrow === 'string' &&
                'text-xs font-semibold uppercase tracking-wide text-brand-700',
            )}
          >
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
