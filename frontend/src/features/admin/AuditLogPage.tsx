import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import { auditApi, type AuditLogDto } from '@/api/audit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { useQueryParams } from '@/hooks/useQueryParams';
import { formatDateTime } from '@/lib/format';

const ENTITY_TYPES = [
  '',
  'platform_settings',
  'user',
  'store',
  'product',
  'store_product',
  'category',
  'order',
  'payment',
  'driver',
  'delivery',
  'discount',
  'dispute',
];

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
        {value ? JSON.stringify(value, null, 2) : '—'}
      </pre>
    </div>
  );
}

export default function AuditLogPage() {
  const [params, setParams] = useQueryParams({ page: 1, action: '', entityType: '' });
  const [selected, setSelected] = useState<AuditLogDto | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () =>
      auditApi.list({
        page: params.page,
        limit: 20,
        action: params.action || undefined,
        entityType: params.entityType || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AuditLogDto>[] = [
    {
      key: 'time',
      header: 'When',
      cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{r.actorEmail ?? 'System'}</p>
          {r.actorRoles && <p className="text-xs text-slate-500">{r.actorRoles}</p>}
        </div>
      ),
    },
    { key: 'action', header: 'Action', cell: (r) => <Badge tone="brand">{r.action}</Badge> },
    {
      key: 'entity',
      header: 'Entity',
      hideBelow: 'md',
      cell: (r) => (
        <span className="text-slate-600">
          {r.entityType}
          {r.entityId && (
            <span className="ml-1 font-mono text-xs text-slate-400">{r.entityId.slice(0, 8)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      hideBelow: 'lg',
      cell: (r) => <span className="font-mono text-xs text-slate-500">{r.ip ?? '–'}</span>,
    },
    {
      key: 'view',
      header: <span className="sr-only">Details</span>,
      align: 'right',
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(r)}
          leftIcon={<Eye className="size-4" aria-hidden />}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="A tamper-evident trail of important actions taken on the platform."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          className="w-full sm:w-72"
          label="Filter by action"
          placeholder="Action, e.g. settings.update"
          value={params.action}
          onChange={(v) => setParams({ action: v })}
        />
        <Select
          hideLabel
          label="Entity type"
          value={params.entityType}
          onChange={(e) => setParams({ entityType: e.target.value })}
          wrapperClassName="w-full sm:w-56"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t || 'All entity types'}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        caption="Audit log entries"
        columns={columns}
        data={query.data}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(r) => r.id}
        onPageChange={(page) => setParams({ page })}
        emptyTitle="No audit entries"
        emptyDescription="Actions such as settings changes, approvals and refunds will appear here."
      />
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action ?? ''}
        description={
          selected
            ? `${formatDateTime(selected.createdAt)} · ${selected.actorEmail ?? 'System'}`
            : undefined
        }
        size="lg"
      >
        {selected && (
          <div className="grid gap-4 md:grid-cols-2">
            <JsonBlock title="Before" value={selected.before} />
            <JsonBlock title="After" value={selected.after} />
            {selected.metadata && <JsonBlock title="Metadata" value={selected.metadata} />}
            <p className="text-xs text-slate-500 md:col-span-2">
              Request ID: <span className="font-mono">{selected.requestId ?? '–'}</span>
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
