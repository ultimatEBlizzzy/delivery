import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { InventoryMovementDto } from '@hardware-delivery/shared';
import { listingApi } from '@/api/catalogue';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { ListingsPanel } from '@/features/catalogue/ListingsPanel';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

const REASONS: Record<string, string> = {
  INITIAL_STOCK: 'Opening stock',
  RESTOCK: 'Restock',
  ADJUSTMENT: 'Stock-take',
  CORRECTION: 'Correction',
  SALE: 'Sold',
  ORDER_CANCELLED: 'Order cancelled',
};

function History({ scope }: { scope: 'store' | 'admin' }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['movements', scope, 'all', page],
    queryFn: () => listingApi(scope).movements({ page, limit: 20 }),
    placeholderData: (p) => p,
  });
  const columns: Column<InventoryMovementDto>[] = [
    {
      key: 'when',
      header: 'When',
      cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.createdAt)}</span>,
    },
    {
      key: 'product',
      header: 'Product',
      cell: (m) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{m.product?.name}</p>
          <p className="text-xs text-slate-500">{m.product?.sku}</p>
        </div>
      ),
    },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      cell: (m) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            m.change > 0 ? 'text-emerald-600' : 'text-red-600',
          )}
        >
          {m.change > 0 ? `+${m.change}` : m.change}
        </span>
      ),
    },
    {
      key: 'after',
      header: 'Level after',
      align: 'right',
      hideBelow: 'sm',
      cell: (m) => <span className="tabular-nums">{m.quantityAfter}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      hideBelow: 'md',
      cell: (m) => REASONS[m.reason] ?? m.reason,
    },
    {
      key: 'by',
      header: 'By / note',
      hideBelow: 'lg',
      cell: (m) => (
        <span className="text-slate-600">
          {m.actorName ?? (m.orderId ? 'Customer order' : 'System')}
          {m.note ? ` – ${m.note}` : ''}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption="Stock movements"
      columns={columns}
      data={query.data}
      loading={query.isFetching}
      error={query.error}
      onRetry={() => query.refetch()}
      rowKey={(m) => m.id}
      onPageChange={setPage}
      emptyTitle="No stock movements yet"
    />
  );
}

export default function StoreInventoryPage() {
  const [tab, setTab] = useState<'levels' | 'history'>('levels');
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Keep stock accurate so customers never order what you cannot supply. Orders reduce stock automatically."
      />
      <Tabs
        label="Inventory views"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'levels', label: 'Stock levels' },
          { id: 'history', label: 'History' },
        ]}
        className="mb-5"
      />
      {tab === 'levels' ? (
        <ListingsPanel scope="store" mode="inventory" />
      ) : (
        <History scope="store" />
      )}
    </div>
  );
}
