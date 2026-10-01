import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Feedback';

const iconTones = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  info: 'bg-sky-50 text-sky-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  purple: 'bg-violet-50 text-violet-600',
  neutral: 'bg-slate-100 text-slate-600',
};

export function StatCard({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
  delta,
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof iconTones;
  hint?: ReactNode;
  /** Percentage change vs previous period; positive = good. */
  delta?: number | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-slate-900">
              {value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg',
              iconTones[tone],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {!loading && (hint || delta !== undefined) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          {delta !== undefined && delta !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                delta >= 0 ? 'text-emerald-600' : 'text-red-600',
              )}
            >
              {delta >= 0 ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  );
}
