import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ListingDto } from '@hardware-delivery/shared';
import { listingApi } from '@/api/catalogue';
import { CategorySelect } from '@/components/CategorySelect';
import { ProductThumb } from '@/components/ProductThumb';
import { StockBadge } from '@/components/StockBadge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select, Switch } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { useQueryParams } from '@/hooks/useQueryParams';
import { confirm } from '@/store/confirm.store';
import { AddListingModal } from './AddListingModal';
import {
  EditListingModal,
  MovementsModal,
  PriceCell,
  StockAdjustModal,
  type Scope,
} from './ListingForms';

function IconAction({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-lg p-2 hover:bg-slate-100 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-500 hover:text-slate-900'}`}
    >
      {children}
    </button>
  );
}

/**
 * Table of store offers with filters and actions. One component, three uses:
 *  - store portal "Products"   (scope=store, mode=products)
 *  - store portal "Inventory"  (scope=store, mode=inventory)
 *  - admin store page / admin Inventory (scope=admin; `storeId` pins one store, otherwise all stores)
 */
export function ListingsPanel({
  scope,
  storeId,
  mode = 'products',
  canEdit = true,
  emptyHint,
}: {
  scope: Scope;
  storeId?: string;
  mode?: 'products' | 'inventory';
  /** Staff members without price rights can still adjust stock. */
  canEdit?: boolean;
  emptyHint?: string;
}) {
  const qc = useQueryClient();
  const api = listingApi(scope);
  const [params, setParams] = useQueryParams({
    page: 1,
    search: '',
    categoryId: '',
    stock: '',
    storeId: '',
  });
  const [editing, setEditing] = useState<ListingDto | null>(null);
  const [adjusting, setAdjusting] = useState<ListingDto | null>(null);
  const [history, setHistory] = useState<ListingDto | null>(null);
  const [adding, setAdding] = useState(false);

  const effectiveStore = storeId ?? (params.storeId || undefined);
  const queryKey = [
    'listings',
    scope,
    effectiveStore,
    params.page,
    params.search,
    params.categoryId,
    params.stock,
  ];
  const query = useQuery({
    queryKey,
    queryFn: () =>
      api.list({
        page: params.page,
        limit: 15,
        search: params.search || undefined,
        categoryId: params.categoryId || undefined,
        stock: (params.stock || undefined) as 'low' | 'out' | 'in' | undefined,
        storeId: scope === 'admin' ? effectiveStore : undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const toggleAvailable = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      api.update(id, { available }),
    onMutate: async ({ id, available }) => {
      await qc.cancelQueries({ queryKey: ['listings'] });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old: typeof query.data) =>
        old ? { ...old, data: old.data.map((l) => (l.id === id ? { ...l, available } : l)) } : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(queryKey, ctx?.previous),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.remove(id),
    meta: { successMessage: 'Product removed from the store' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const showStore = scope === 'admin' && !storeId;
  const product: Column<ListingDto> = {
    key: 'product',
    header: 'Product',
    cell: (l) => (
      <div className="flex min-w-0 items-center gap-3">
        <ProductThumb src={l.product.primaryImageUrl} className="size-11" />
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{l.product.name}</p>
          <p className="truncate text-xs text-slate-500">
            {l.product.sku}
            {l.product.packSize ? ` · ${l.product.packSize}` : ''}
          </p>
        </div>
      </div>
    ),
  };
  const store: Column<ListingDto> = {
    key: 'store',
    header: 'Store',
    hideBelow: 'md',
    cell: (l) => <span className="text-slate-700">{l.store?.name ?? '–'}</span>,
  };
  const stock: Column<ListingDto> = {
    key: 'stock',
    header: 'Stock',
    cell: (l) => <StockBadge status={l.stockStatus} quantity={l.stockQuantity} />,
  };
  const columns: Column<ListingDto>[] =
    mode === 'inventory'
      ? [
          product,
          ...(showStore ? [store] : []),
          stock,
          {
            key: 'alert',
            header: 'Alert at',
            hideBelow: 'md',
            align: 'right',
            cell: (l) => <span className="tabular-nums text-slate-600">{l.lowStockThreshold}</span>,
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            cell: (l) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Boxes className="size-4" aria-hidden />}
                  onClick={() => setAdjusting(l)}
                >
                  Adjust
                </Button>
                <IconAction
                  label={`Stock history for ${l.product.name}`}
                  onClick={() => setHistory(l)}
                >
                  <History className="size-4" aria-hidden />
                </IconAction>
              </div>
            ),
          },
        ]
      : [
          product,
          ...(showStore ? [store] : []),
          { key: 'price', header: 'Price', cell: (l) => <PriceCell listing={l} /> },
          stock,
          {
            key: 'limits',
            header: 'Order limits',
            hideBelow: 'lg',
            cell: (l) => (
              <span className="whitespace-nowrap text-slate-600">
                {l.maximumQuantity
                  ? `${l.minimumQuantity}–${l.maximumQuantity}`
                  : `${l.minimumQuantity}+`}
              </span>
            ),
          },
          {
            key: 'available',
            header: 'Visible',
            align: 'center',
            cell: (l) => (
              <Switch
                checked={l.available}
                disabled={!canEdit}
                label={`${l.product.name} visible to customers`}
                onChange={(available) => toggleAvailable.mutate({ id: l.id, available })}
              />
            ),
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            cell: (l) => (
              <div className="flex justify-end">
                {canEdit && (
                  <IconAction label={`Edit ${l.product.name}`} onClick={() => setEditing(l)}>
                    <Pencil className="size-4" aria-hidden />
                  </IconAction>
                )}
                <IconAction
                  label={`Adjust stock for ${l.product.name}`}
                  onClick={() => setAdjusting(l)}
                >
                  <Boxes className="size-4" aria-hidden />
                </IconAction>
                <IconAction
                  label={`Stock history for ${l.product.name}`}
                  onClick={() => setHistory(l)}
                >
                  <History className="size-4" aria-hidden />
                </IconAction>
                {canEdit && (
                  <IconAction
                    danger
                    label={`Remove ${l.product.name}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Remove “${l.product.name}”?`,
                          message:
                            'It disappears from customer search. Past orders are not affected.',
                          confirmLabel: 'Remove',
                          tone: 'danger',
                        })
                      ) {
                        remove.mutate(l.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconAction>
                )}
              </div>
            ),
          },
        ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full sm:w-72"
          value={params.search}
          onChange={(v) => setParams({ search: v })}
          placeholder="Search name, SKU or brand…"
          label="Search products"
        />
        <CategorySelect
          hideLabel
          label="Category"
          emptyLabel="All categories"
          value={params.categoryId}
          onChange={(e) => setParams({ categoryId: e.target.value })}
          wrapperClassName="w-full sm:w-52"
        />
        <Select
          hideLabel
          label="Stock level"
          value={params.stock}
          onChange={(e) => setParams({ stock: e.target.value })}
          wrapperClassName="w-full sm:w-52"
        >
          <option value="">Any stock level</option>
          <option value="in">Well stocked</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Select>
        {mode === 'products' && canEdit && (
          <Button
            className="sm:ml-auto"
            leftIcon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add product
          </Button>
        )}
      </div>

      <DataTable
        caption={mode === 'inventory' ? 'Stock levels' : 'Store products'}
        columns={columns}
        data={query.data}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(l) => l.id}
        onPageChange={(page) => setParams({ page })}
        emptyTitle={
          params.search || params.categoryId || params.stock
            ? 'No products match your filters'
            : 'No products yet'
        }
        emptyDescription={
          emptyHint ??
          (canEdit
            ? 'Add a product from the shared catalogue and set your own price and stock.'
            : undefined)
        }
        emptyAction={
          !params.search && canEdit && mode === 'products' ? (
            <Button
              leftIcon={<Plus className="size-4" aria-hidden />}
              onClick={() => setAdding(true)}
            >
              Add your first product
            </Button>
          ) : undefined
        }
      />

      <EditListingModal scope={scope} listing={editing} onClose={() => setEditing(null)} />
      <StockAdjustModal scope={scope} listing={adjusting} onClose={() => setAdjusting(null)} />
      <MovementsModal scope={scope} listing={history} onClose={() => setHistory(null)} />
      <AddListingModal
        scope={scope}
        storeId={effectiveStore}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}
