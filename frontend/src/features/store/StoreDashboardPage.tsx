import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackageCheck, PackageX, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { describeHoursNow, type ListingDto } from '@hardware-delivery/shared';
import { listingApi } from '@/api/catalogue';
import { storeApi } from '@/api/stores';
import { ProductThumb } from '@/components/ProductThumb';
import { StockBadge } from '@/components/StockBadge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { Switch } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StockAdjustModal } from '@/features/catalogue/ListingForms';
import { useMyStore } from './useMyStore';

const api = listingApi('store');

export default function StoreDashboardPage() {
  const qc = useQueryClient();
  const { store, isLoading, error, refetch, canEdit } = useMyStore();
  const [adjusting, setAdjusting] = useState<ListingDto | null>(null);

  const total = useQuery({
    queryKey: ['listings', 'store', 'count', 'all'],
    queryFn: () => api.list({ limit: 1 }),
  });
  const low = useQuery({
    queryKey: ['listings', 'store', 'count', 'low'],
    queryFn: () => api.list({ limit: 6, stock: 'low' }),
  });
  const out = useQuery({
    queryKey: ['listings', 'store', 'count', 'out'],
    queryFn: () => api.list({ limit: 6, stock: 'out' }),
  });

  const accepting = useMutation({
    mutationFn: (acceptingOrders: boolean) => storeApi.updateMe({ acceptingOrders }),
    meta: { successMessage: 'Updated' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['store', 'me'] }),
  });

  if (isLoading) return <PageLoader />;
  if (error || !store) return <ErrorState error={error} onRetry={() => refetch()} />;

  const attention = [...(out.data?.data ?? []), ...(low.data?.data ?? [])].slice(0, 6);
  return (
    <div>
      <PageHeader
        title={`Welcome, ${store.name}`}
        description={`${describeHoursNow(store.operatingHours)} · ${[store.suburb, store.city].filter(Boolean).join(', ')}`}
      />

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Accepting new orders</h2>
            <p className="text-sm text-slate-500">
              {store.acceptingOrders
                ? 'Customers can order from you right now.'
                : 'Paused – customers can browse but cannot place new orders.'}
            </p>
          </div>
          <Switch
            size="lg"
            checked={store.acceptingOrders}
            disabled={!canEdit || accepting.isPending}
            label="Accepting new orders"
            onChange={(v) => accepting.mutate(v)}
          />
        </CardBody>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Products listed"
          value={total.data?.meta.total ?? '–'}
          icon={<PackageCheck className="size-5" aria-hidden />}
          loading={total.isLoading}
        />
        <StatCard
          label="Low stock"
          value={low.data?.meta.total ?? '–'}
          tone="warning"
          icon={<AlertTriangle className="size-5" aria-hidden />}
          loading={low.isLoading}
          hint="at or below the alert level"
        />
        <StatCard
          label="Out of stock"
          value={out.data?.meta.total ?? '–'}
          tone="danger"
          icon={<PackageX className="size-5" aria-hidden />}
          loading={out.isLoading}
          hint="hidden from ordering"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Needs attention"
            description="Restock these before customers miss out."
            action={
              <Link
                to="/store/inventory"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                All inventory
              </Link>
            }
          />
          {attention.length === 0 ? (
            <EmptyState
              icon={<Boxes className="size-7" aria-hidden />}
              title="Stock looks healthy"
              description="Items running low or out of stock will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                  <ProductThumb src={l.product.primaryImageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{l.product.name}</p>
                    <p className="text-xs text-slate-500">{l.product.sku}</p>
                  </div>
                  <StockBadge status={l.stockStatus} quantity={l.stockQuantity} />
                  <Button size="sm" variant="outline" onClick={() => setAdjusting(l)}>
                    Restock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Quick actions" />
          <CardBody className="flex flex-col gap-3">
            {canEdit && (
              <Link to="/store/products" className={buttonClasses({ variant: 'primary' })}>
                <Plus className="size-4" aria-hidden /> Add a product
              </Link>
            )}
            <Link to="/store/inventory" className={buttonClasses({ variant: 'outline' })}>
              Update stock
            </Link>
            <Link to="/store/settings" className={buttonClasses({ variant: 'outline' })}>
              Opening hours & profile
            </Link>
          </CardBody>
        </Card>
      </div>
      <StockAdjustModal scope="store" listing={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}
