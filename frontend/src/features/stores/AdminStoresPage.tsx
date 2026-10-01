import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Power, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoreStatus, type StoreAdminDto } from '@hardware-delivery/shared';
import { storeApi } from '@/api/stores';
import { ProductThumb } from '@/components/ProductThumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Textarea } from '@/components/ui/Input';
import { useQueryParams } from '@/hooks/useQueryParams';
import { formatDate } from '@/lib/format';
import { confirm } from '@/store/confirm.store';
import { StoreFormModal } from './StoreFormModal';

export function StoreStatusBadge({ store }: { store: Pick<StoreAdminDto, 'status' | 'isActive'> }) {
  if (store.status === StoreStatus.APPROVED && !store.isActive)
    return <Badge tone="danger">Suspended</Badge>;
  const tone =
    store.status === StoreStatus.APPROVED
      ? 'success'
      : store.status === StoreStatus.PENDING
        ? 'warning'
        : 'danger';
  return <Badge tone={tone}>{store.status.charAt(0) + store.status.slice(1).toLowerCase()}</Badge>;
}

/** Rejection needs a reason the owner can act on. */
export function RejectStoreModal({
  store,
  onClose,
}: {
  store: StoreAdminDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => storeApi.setStatus(store!.id, StoreStatus.REJECTED, reason.trim()),
    meta: { successMessage: 'Store rejected' },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
      setReason('');
      onClose();
    },
  });
  return (
    <Modal
      open={!!store}
      onClose={onClose}
      busy={reject.isPending}
      size="sm"
      title={`Reject ${store?.name ?? 'store'}?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={reject.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => reject.mutate()}
            loading={reject.isPending}
            disabled={reason.trim().length < 3}
          >
            Reject store
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        required
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Shown to the store so they know what to fix."
      />
    </Modal>
  );
}

export default function AdminStoresPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useQueryParams({ page: 1, search: '', status: '', active: '' });
  const [editing, setEditing] = useState<StoreAdminDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<StoreAdminDto | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'stores', params],
    queryFn: () =>
      storeApi.adminList({
        page: params.page,
        limit: 15,
        search: params.search || undefined,
        status: (params.status || undefined) as StoreStatus | undefined,
        isActive: params.active === '' ? undefined : params.active === 'true',
      }),
    placeholderData: (prev) => prev,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
  const approve = useMutation({
    mutationFn: (s: StoreAdminDto) => storeApi.setStatus(s.id, StoreStatus.APPROVED),
    meta: { successMessage: 'Store approved' },
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: ({ s, active }: { s: StoreAdminDto; active: boolean }) =>
      storeApi.setActive(s.id, active),
    meta: { successMessage: 'Store updated' },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (s: StoreAdminDto) => storeApi.remove(s.id),
    meta: { successMessage: 'Store deleted' },
    onSuccess: refresh,
  });

  const columns: Column<StoreAdminDto>[] = [
    {
      key: 'store',
      header: 'Store',
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={s.logoUrl} className="size-10 rounded-full" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{s.name}</p>
            <p className="truncate text-xs text-slate-500">
              {[s.suburb, s.city].filter(Boolean).join(', ')} · {s.province}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (s) => <StoreStatusBadge store={s} /> },
    {
      key: 'listings',
      header: 'Products',
      align: 'right',
      hideBelow: 'sm',
      cell: (s) => <span className="tabular-nums">{s.listingCount}</span>,
    },
    {
      key: 'staff',
      header: 'Staff',
      align: 'right',
      hideBelow: 'md',
      cell: (s) => <span className="tabular-nums">{s.staffCount}</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      hideBelow: 'lg',
      cell: (s) =>
        s.ratingCount ? (
          `${s.ratingAverage.toFixed(1)} / 5 (${s.ratingCount})`
        ) : (
          <span className="text-slate-400">No ratings</span>
        ),
    },
    { key: 'created', header: 'Added', hideBelow: 'lg', cell: (s) => formatDate(s.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (s) => (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Menu
            label={`Actions for ${s.name}`}
            trigger={
              <span className="flex rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <MoreHorizontal className="size-5" aria-hidden />
              </span>
            }
            items={[
              {
                label: 'Edit details',
                icon: <Pencil className="size-4" aria-hidden />,
                onSelect: () => setEditing(s),
              },
              {
                label: 'Approve',
                icon: <CheckCircle2 className="size-4" aria-hidden />,
                hidden: s.status === StoreStatus.APPROVED,
                onSelect: () => approve.mutate(s),
              },
              {
                label: 'Reject…',
                icon: <XCircle className="size-4" aria-hidden />,
                hidden: s.status === StoreStatus.REJECTED,
                onSelect: () => setRejecting(s),
              },
              {
                label: s.isActive ? 'Suspend' : 'Reactivate',
                icon: <Power className="size-4" aria-hidden />,
                hidden: s.status !== StoreStatus.APPROVED,
                onSelect: async () => {
                  if (
                    !s.isActive ||
                    (await confirm({
                      title: `Suspend ${s.name}?`,
                      message:
                        'It disappears from customer search and cannot receive orders until reactivated.',
                      confirmLabel: 'Suspend',
                      tone: 'danger',
                    }))
                  ) {
                    setActive.mutate({ s, active: !s.isActive });
                  }
                },
              },
              {
                label: 'Delete',
                tone: 'danger',
                icon: <Trash2 className="size-4" aria-hidden />,
                onSelect: async () => {
                  if (
                    await confirm({
                      title: `Delete ${s.name}?`,
                      message:
                        'The store, its listings and its staff access are removed. Stores with orders in progress cannot be deleted.',
                      confirmLabel: 'Delete store',
                      tone: 'danger',
                    })
                  )
                    remove.mutate(s);
                },
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stores"
        description="Hardware stores on the platform."
        actions={
          <Button
            leftIcon={<Plus className="size-4" aria-hidden />}
            onClick={() => setCreating(true)}
          >
            Add store
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          className="w-full sm:w-72"
          value={params.search}
          onChange={(v) => setParams({ search: v })}
          placeholder="Search name, town or email…"
          label="Search stores"
        />
        <Select
          hideLabel
          label="Status"
          value={params.status}
          onChange={(e) => setParams({ status: e.target.value })}
          wrapperClassName="w-full sm:w-48"
        >
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </Select>
        <Select
          hideLabel
          label="Availability"
          value={params.active}
          onChange={(e) => setParams({ active: e.target.value })}
          wrapperClassName="w-full sm:w-52"
        >
          <option value="">Any availability</option>
          <option value="true">Active only</option>
          <option value="false">Suspended only</option>
        </Select>
      </div>
      <DataTable
        caption="Hardware stores"
        columns={columns}
        data={query.data}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(s) => s.id}
        onRowClick={(s) => navigate(`/admin/stores/${s.id}`)}
        onPageChange={(page) => setParams({ page })}
        emptyTitle={
          params.search || params.status || params.active
            ? 'No stores match your filters'
            : 'No stores yet'
        }
        emptyDescription="Add the first hardware store, its owner account, prices and stock."
        emptyAction={
          !params.search ? (
            <Button
              leftIcon={<Plus className="size-4" aria-hidden />}
              onClick={() => setCreating(true)}
            >
              Add store
            </Button>
          ) : undefined
        }
      />
      <StoreFormModal
        open={creating || !!editing}
        store={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <RejectStoreModal store={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}
