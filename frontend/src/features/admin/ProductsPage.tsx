import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProductDto } from '@hardware-delivery/shared';
import { productApi } from '@/api/catalogue';
import { CategorySelect } from '@/components/CategorySelect';
import { ProductThumb } from '@/components/ProductThumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ProductFormModal } from '@/features/catalogue/ProductForms';
import { useQueryParams } from '@/hooks/useQueryParams';
import { formatWeight } from '@/lib/format';
import { confirm } from '@/store/confirm.store';

export default function ProductsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useQueryParams({ page: 1, search: '', categoryId: '', active: '' });
  const [form, setForm] = useState<{ product: ProductDto | null } | null>(null);

  const query = useQuery({
    queryKey: ['products', 'admin', params],
    queryFn: () =>
      productApi.adminList({
        page: params.page,
        limit: 15,
        search: params.search || undefined,
        categoryId: params.categoryId || undefined,
        isActive: params.active === '' ? undefined : params.active === 'true',
      }),
    placeholderData: (prev) => prev,
  });
  const remove = useMutation({
    mutationFn: (id: string) => productApi.remove(id),
    meta: { successMessage: 'Product deleted' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const columns: Column<ProductDto>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={p.primaryImageUrl} className="size-11" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{p.name}</p>
            <p className="truncate text-xs text-slate-500">
              {p.sku}
              {p.brand ? ` · ${p.brand}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideBelow: 'md', cell: (p) => p.category.name },
    { key: 'pack', header: 'Pack', hideBelow: 'lg', cell: (p) => p.packSize ?? p.unit },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      hideBelow: 'lg',
      cell: (p) => <span className="tabular-nums">{formatWeight(p.weightKg)}</span>,
    },
    {
      key: 'stores',
      header: 'Stores',
      align: 'right',
      hideBelow: 'sm',
      cell: (p) => <span className="tabular-nums">{p.listingCount ?? 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) =>
        p.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={`Edit ${p.name}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => setForm({ product: p })}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete ${p.name}`}
            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
            onClick={async () => {
              if (
                await confirm({
                  title: `Delete “${p.name}”?`,
                  message: 'Products that stores list cannot be deleted – deactivate them instead.',
                  confirmLabel: 'Delete',
                  tone: 'danger',
                })
              )
                remove.mutate(p.id);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="The shared catalogue. Each store sets its own price and stock for these products."
        actions={
          <Button
            leftIcon={<Plus className="size-4" aria-hidden />}
            onClick={() => setForm({ product: null })}
          >
            Add product
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          className="w-full sm:w-72"
          value={params.search}
          onChange={(v) => setParams({ search: v })}
          placeholder="Search name, SKU or brand…"
          label="Search products"
        />
        <CategorySelect
          admin
          hideLabel
          label="Category"
          emptyLabel="All categories"
          value={params.categoryId}
          onChange={(e) => setParams({ categoryId: e.target.value })}
          wrapperClassName="w-full sm:w-56"
        />
        <Select
          hideLabel
          label="Status"
          value={params.active}
          onChange={(e) => setParams({ active: e.target.value })}
          wrapperClassName="w-full sm:w-48"
        >
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>
      <DataTable
        caption="Catalogue products"
        columns={columns}
        data={query.data}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(p) => p.id}
        onRowClick={(p) => setForm({ product: p })}
        onPageChange={(page) => setParams({ page })}
        emptyTitle={
          params.search || params.categoryId || params.active
            ? 'No products match your filters'
            : 'The catalogue is empty'
        }
        emptyDescription="Add products here, then list them in stores with each store's own price."
      />
      <ProductFormModal
        scope="admin"
        open={!!form}
        product={form?.product}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
