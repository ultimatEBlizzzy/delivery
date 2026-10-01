import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { validateOperatingHours, type OperatingHours } from '@hardware-delivery/shared';
import { storeApi } from '@/api/stores';
import { HoursEditor } from '@/components/HoursEditor';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { Input, Switch, Textarea } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { optionalPhoneSchema } from '@/features/auth/schemas';
import { StoreStatusBadge } from '@/features/stores/AdminStoresPage';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from '@/store/toast.store';
import { useMyStore } from './useMyStore';

const schema = z.object({
  description: z.string().trim().max(2000, 'At most 2000 characters'),
  phone: optionalPhoneSchema,
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
});
type Values = z.infer<typeof schema>;

export default function StoreSettingsPage() {
  const qc = useQueryClient();
  const { store, isLoading, error, refetch, canEdit } = useMyStore();
  const [hours, setHours] = useState<OperatingHours | null>(null);
  const [accepting, setAccepting] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', phone: '', email: '' },
  });

  useEffect(() => {
    if (!store) return;
    form.reset({
      description: store.description ?? '',
      phone: store.phone ?? '',
      email: store.email ?? '',
    });
    setHours(store.operatingHours);
    setAccepting(store.acceptingOrders);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per fetched store
  }, [store?.id]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const problem = hours ? validateOperatingHours(hours) : null;
      if (problem) throw new Error(problem);
      return storeApi.updateMe({
        description: v.description || null,
        phone: v.phone || null,
        email: v.email || null,
        operatingHours: hours ?? undefined,
        acceptingOrders: accepting,
      });
    },
    meta: { silent: true },
    onSuccess: () => {
      toast.success('Store settings saved');
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ['store', 'me'] });
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  if (isLoading || !hours) return <PageLoader />;
  if (error || !store) return <ErrorState error={error} onRetry={() => refetch()} />;
  const e = form.formState.errors;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Store settings" description="How customers see and reach your store." />
      {!canEdit && (
        <Alert tone="info" className="mb-4">
          Only owners and managers can change store settings.
        </Alert>
      )}
      {formError && <Alert className="mb-4">{formError}</Alert>}
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
        <Card>
          <CardHeader
            title="Profile"
            description="Your name and address are managed by the platform – contact support to change them."
            action={<StoreStatusBadge store={store} />}
          />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Store name</dt>
                <dd className="font-medium">{store.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Address</dt>
                <dd className="font-medium">
                  {store.streetAddress}, {[store.suburb, store.city].filter(Boolean).join(', ')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Platform commission</dt>
                <dd className="font-medium">
                  {store.commissionPercent === null
                    ? 'Platform default'
                    : `${store.commissionPercent}%`}
                </dd>
              </div>
            </dl>
            <Textarea
              label="Description"
              rows={3}
              disabled={!canEdit}
              error={e.description?.message}
              hint="Shown on your store page."
              {...form.register('description')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                placeholder="015 123 4567"
                disabled={!canEdit}
                error={e.phone?.message}
                {...form.register('phone')}
              />
              <Input
                label="Email"
                type="email"
                disabled={!canEdit}
                error={e.email?.message}
                {...form.register('email')}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Opening hours"
            description="Shown to customers. Optionally enforced at checkout by the platform."
          />
          <CardBody>
            <div className={canEdit ? '' : 'pointer-events-none opacity-70'}>
              <HoursEditor value={hours} onChange={setHours} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ordering" />
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-900">Accepting new orders</p>
              <p className="text-sm text-slate-500">
                Turn off when you are too busy or closing early.
              </p>
            </div>
            <Switch
              size="lg"
              checked={accepting}
              disabled={!canEdit}
              onChange={setAccepting}
              label="Accepting new orders"
            />
          </CardBody>
        </Card>

        {canEdit && (
          <Card>
            <CardHeader title="Branding" />
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <ImageUpload
                label="Logo"
                imageUrl={store.logoUrl}
                onUpload={async (f) => {
                  await storeApi.setImage(store.id, 'logo', f, 'store');
                  void qc.invalidateQueries({ queryKey: ['store', 'me'] });
                }}
              />
              <ImageUpload
                label="Banner"
                shape="banner"
                imageUrl={store.bannerUrl}
                onUpload={async (f) => {
                  await storeApi.setImage(store.id, 'banner', f, 'store');
                  void qc.invalidateQueries({ queryKey: ['store', 'me'] });
                }}
              />
            </CardBody>
          </Card>
        )}

        {canEdit && (
          <div className="sticky bottom-4 flex justify-end">
            <Button
              type="submit"
              size="lg"
              loading={save.isPending}
              leftIcon={<Save className="size-5" aria-hidden />}
              className="shadow-pop"
            >
              Save settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
