import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Mail, MapPin, Pencil, Phone, Power, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { describeHoursNow, StoreStatus, WEEKDAYS } from '@hardware-delivery/shared';
import { storeApi } from '@/api/stores';
import { ImageUpload } from '@/components/ImageUpload';
import { LazyMap } from '@/components/maps/LazyMap';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { ListingsPanel } from '@/features/catalogue/ListingsPanel';
import { confirm } from '@/store/confirm.store';
import { RejectStoreModal, StoreStatusBadge } from './AdminStoresPage';
import { StaffPanel } from './StaffPanel';
import { StoreFormModal } from './StoreFormModal';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products & prices' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff', label: 'Staff' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const DAY_LABEL: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export default function AdminStoreDetailPage() {
  const { storeId = '' } = useParams();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === searchParams.get('tab'))?.id ?? 'overview') as TabId;
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const query = useQuery({
    queryKey: ['admin', 'stores', 'detail', storeId],
    queryFn: () => storeApi.adminGet(storeId),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
  };
  const approve = useMutation({
    mutationFn: () => storeApi.setStatus(storeId, StoreStatus.APPROVED),
    meta: { successMessage: 'Store approved' },
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: (active: boolean) => storeApi.setActive(storeId, active),
    meta: { successMessage: 'Store updated' },
    onSuccess: refresh,
  });

  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const store = query.data;

  return (
    <div>
      <Link
        to="/admin/stores"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> All stores
      </Link>
      <PageHeader
        title={store.name}
        description={`${[store.suburb, store.city].filter(Boolean).join(', ')} · ${store.province}`}
        eyebrow={<StoreStatusBadge store={store} />}
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={<Pencil className="size-4" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            {store.status !== StoreStatus.APPROVED && (
              <Button
                variant="success"
                leftIcon={<CheckCircle2 className="size-4" aria-hidden />}
                onClick={() => approve.mutate()}
                loading={approve.isPending}
              >
                Approve
              </Button>
            )}
            {store.status !== StoreStatus.REJECTED && (
              <Button
                variant="outline"
                leftIcon={<XCircle className="size-4" aria-hidden />}
                onClick={() => setRejecting(true)}
              >
                Reject
              </Button>
            )}
            {store.status === StoreStatus.APPROVED && (
              <Button
                variant={store.isActive ? 'danger' : 'primary'}
                leftIcon={<Power className="size-4" aria-hidden />}
                loading={setActive.isPending}
                onClick={async () => {
                  if (
                    !store.isActive ||
                    (await confirm({
                      title: `Suspend ${store.name}?`,
                      message: 'It disappears from customer search until reactivated.',
                      confirmLabel: 'Suspend',
                      tone: 'danger',
                    }))
                  )
                    setActive.mutate(!store.isActive);
                }}
              >
                {store.isActive ? 'Suspend' : 'Reactivate'}
              </Button>
            )}
          </>
        }
      />
      {store.status === StoreStatus.REJECTED && store.rejectionReason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Rejected:</strong> {store.rejectionReason}
        </div>
      )}

      <Tabs
        label="Store sections"
        value={tab}
        onChange={(id) => setSearchParams({ tab: id }, { replace: true })}
        tabs={TABS.map((t) => ({ ...t }))}
        className="mb-6"
      />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Contact & address" />
              <CardBody>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                    <div>
                      <dt className="sr-only">Address</dt>
                      <dd>
                        {store.streetAddress}
                        <br />
                        {[store.suburb, store.city, store.postalCode].filter(Boolean).join(', ')}
                        <br />
                        {store.province}
                      </dd>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <Phone className="size-4 shrink-0 text-slate-400" aria-hidden />
                      <div>
                        <dt className="sr-only">Phone</dt>
                        <dd>{store.phone ?? '–'}</dd>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Mail className="size-4 shrink-0 text-slate-400" aria-hidden />
                      <div>
                        <dt className="sr-only">Email</dt>
                        <dd className="break-all">{store.email ?? '–'}</dd>
                      </div>
                    </div>
                  </div>
                  <div>
                    <dt className="text-slate-500">Commission</dt>
                    <dd className="font-medium">
                      {store.commissionPercent === null
                        ? 'Platform default'
                        : `${store.commissionPercent}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Rating</dt>
                    <dd className="font-medium">
                      {store.ratingCount
                        ? `${store.ratingAverage.toFixed(1)} / 5 (${store.ratingCount} reviews)`
                        : 'No ratings yet'}
                    </dd>
                  </div>
                </dl>
                {store.description && (
                  <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    {store.description}
                  </p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Location"
                description={`${store.latitude.toFixed(5)}, ${store.longitude.toFixed(5)}`}
              />
              <div className="overflow-hidden rounded-b-xl">
                <LazyMap
                  height={280}
                  ariaLabel={`Map showing ${store.name}`}
                  zoom={13}
                  markers={[
                    {
                      id: store.id,
                      kind: 'store',
                      position: [store.latitude, store.longitude],
                      label: store.name,
                    },
                  ]}
                />
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Opening hours"
                description={describeHoursNow(store.operatingHours)}
              />
              <CardBody>
                <dl className="space-y-1.5 text-sm">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="flex justify-between gap-4">
                      <dt className="text-slate-600">{DAY_LABEL[d]}</dt>
                      <dd className="font-medium tabular-nums">
                        {store.operatingHours[d].closed ? (
                          <span className="text-slate-400">Closed</span>
                        ) : (
                          `${store.operatingHours[d].open} – ${store.operatingHours[d].close}`
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Branding" />
              <CardBody className="space-y-5">
                <ImageUpload
                  label="Logo"
                  imageUrl={store.logoUrl}
                  onUpload={async (f) => {
                    await storeApi.setImage(storeId, 'logo', f);
                    refresh();
                  }}
                />
                <ImageUpload
                  label="Banner"
                  shape="banner"
                  imageUrl={store.bannerUrl}
                  onUpload={async (f) => {
                    await storeApi.setImage(storeId, 'banner', f);
                    refresh();
                  }}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
      {tab === 'products' && <ListingsPanel scope="admin" storeId={storeId} mode="products" />}
      {tab === 'inventory' && <ListingsPanel scope="admin" storeId={storeId} mode="inventory" />}
      {tab === 'staff' && <StaffPanel scope="admin" storeId={storeId} />}

      <StoreFormModal open={editing} store={store} onClose={() => setEditing(false)} />
      <RejectStoreModal store={rejecting ? store : null} onClose={() => setRejecting(false)} />
    </div>
  );
}
