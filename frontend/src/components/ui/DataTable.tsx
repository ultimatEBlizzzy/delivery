import type { Paginated } from '@hardware-delivery/shared';
import type { Key, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState, ErrorState, Skeleton } from './Feedback';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
  /** Hide on small screens (the row detail is still reachable via row click). */
  hideBelow?: 'sm' | 'md' | 'lg';
}

interface DataTableProps<T> {
  /** Accessible table name, announced by screen readers. */
  caption: string;
  columns: Column<T>[];
  data?: Paginated<T> | { data: T[]; meta?: undefined };
  rowKey: (row: T) => Key;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  skeletonRows?: number;
  className?: string;
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };
const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * Server-driven table: renders loading skeletons, an error state with retry, an empty state and
 * pagination controls. Sorting/filtering/paging all happen on the server.
 */
export function DataTable<T>({
  caption,
  columns,
  data,
  rowKey,
  loading,
  error,
  onRetry,
  onPageChange,
  onRowClick,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  const rows = data?.data ?? [];
  const showSkeleton = loading && rows.length === 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    alignClass[c.align ?? 'left'],
                    c.hideBelow && hide[c.hideBelow],
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={cn(
              'divide-y divide-slate-100',
              loading && rows.length > 0 && 'opacity-60 transition-opacity',
            )}
          >
            {showSkeleton &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3.5', c.hideBelow && hide[c.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}
            {!showSkeleton &&
              !error &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3 align-middle text-slate-700',
                        alignClass[c.align ?? 'left'],
                        c.hideBelow && hide[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !loading && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : null}
      {data?.meta && onPageChange && (
        <div className="border-t border-slate-100 px-4">
          <Pagination meta={data.meta} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
