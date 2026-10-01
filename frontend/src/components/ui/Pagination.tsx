import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@hardware-delivery/shared';
import { Button } from './Button';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm text-slate-600"
    >
      <p>
        Showing <span className="font-medium text-slate-900">{from}</span>–
        <span className="font-medium text-slate-900">{to}</span> of{' '}
        <span className="font-medium text-slate-900">{meta.total.toLocaleString('en-ZA')}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          leftIcon={<ChevronLeft className="size-4" aria-hidden />}
        >
          Previous
        </Button>
        <span aria-current="page" className="min-w-16 text-center">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          rightIcon={<ChevronRight className="size-4" aria-hidden />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
