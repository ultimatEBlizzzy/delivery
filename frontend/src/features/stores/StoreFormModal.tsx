import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  DEFAULT_OPERATING_HOURS,
  SA_PROVINCES,
  type OperatingHours,
  type StoreAdminDto,
  validateOperatingHours,
} from '@hardware-delivery/shared';
import { mapsApi, storeApi, type StoreInput } from '@/api/stores';
import { CredentialsDialog } from '@/components/CredentialsDialog';
import { HoursEditor } from '@/components/HoursEditor';
import { MapPicker } from '@/components/maps/MapPicker';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input, PasswordInput, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { optionalPhoneSchema } from '@/features/auth/schemas';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import {
  coordField,
  numToField,
  optionalDecimalField,
  parseNumber,
  toNullableNumber,
} from '@/lib/form-schemas';
import { toast } from '@/store/toast.store';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_REGEX } from '@hardware-delivery/shared';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the store name').max(150),
  description: z.string().trim().max(2000),
  phone: optionalPhoneSchema,
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
  streetAddress: z.string().trim().min(3, 'Enter the street address').max(255),
  suburb: z.string().trim().max(100),
  city: z.string().trim().min(2, 'Enter the town or city').max(100),
  province: z.string().min(1, 'Choose a province'),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}$/.test(v), 'Postal codes have 4 digits'),
  latitude: coordField('Latitude', -90, 90),
  longitude: coordField('Longitude', -180, 180),
  commissionPercent: optionalDecimalField('Commission', 50, 2),
  ownerEmail: z.string().trim(),
  ownerFirstName: z.string().trim(),
  ownerLastName: z.string().trim(),
  ownerPhone: optionalPhoneSchema,
  ownerPassword: z.string(),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: '',
  description: '',
  phone: '',
  email: '',
  streetAddress: '',
  suburb: '',
  city: '',
  province: 'Limpopo',
  postalCode: '',
  latitude: '',
  longitude: '',
  commissionPercent: '',
  ownerEmail: '',
  ownerFirstName: '',
  ownerLastName: '',
  ownerPhone: '',
  ownerPassword: '',
};

const toValues = (s: StoreAdminDto): Values => ({
  ...EMPTY,
  name: s.name,
  description: s.description ?? '',
  phone: s.phone ?? '',
  email: s.email ?? '',
  streetAddress: s.streetAddress,
  suburb: s.suburb ?? '',
  city: s.city,
  province: s.province,
  postalCode: s.postalCode ?? '',
  latitude: String(s.latitude),
  longitude: String(s.longitude),
  commissionPercent: numToField(s.commissionPercent),
});

/** Create (with owner account) or edit a store: address + map pin, opening hours, commission override. */
export function StoreFormModal({
  open,
  store,
  onClose,
}: {
  open: boolean;
  store?: StoreAdminDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!store;
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_OPERATING_HOURS);
  const [formError, setFormError] = useState<string | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(
      schema.superRefine((v, ctx) => {
        if (isEdit) return;
        if (!v.ownerEmail || !z.email().safeParse(v.ownerEmail).success)
          ctx.addIssue({
            code: 'custom',
            path: ['ownerEmail'],
            message: 'Enter the owner’s email address',
          });
        if (!v.ownerFirstName)
          ctx.addIssue({
            code: 'custom',
            path: ['ownerFirstName'],
            message: 'First name is required',
          });
        if (!v.ownerLastName)
          ctx.addIssue({
            code: 'custom',
            path: ['ownerLastName'],
            message: 'Last name is required',
          });
        if (
          v.ownerPassword &&
          (v.ownerPassword.length < 8 || !PASSWORD_REGEX.test(v.ownerPassword))
        )
          ctx.addIssue({
            code: 'custom',
            path: ['ownerPassword'],
            message: PASSWORD_POLICY_MESSAGE,
          });
      }),
    ),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setGeoMessage(null);
    setHours(store?.operatingHours ?? DEFAULT_OPERATING_HOURS);
    form.reset(store ? toValues(store) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when (re)opened or switched to another store
  }, [open, store?.id]);

  const geocode = useMutation({
    mutationFn: () => {
      const v = form.getValues();
      return mapsApi.geocode(
        [v.streetAddress, v.suburb, v.city, v.province, 'South Africa'].filter(Boolean).join(', '),
      );
    },
    meta: { silent: true },
    onSuccess: (r) => {
      form.setValue('latitude', String(r.latitude), { shouldValidate: true, shouldDirty: true });
      form.setValue('longitude', String(r.longitude), { shouldValidate: true, shouldDirty: true });
      setGeoMessage(`Found: ${r.formattedAddress}. Drag the pin to fine-tune.`);
    },
    onError: (err) => setGeoMessage(getErrorMessage(err)),
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const hoursProblem = validateOperatingHours(hours);
      if (hoursProblem) throw new Error(hoursProblem);
      const body: StoreInput = {
        name: v.name,
        description: v.description || null,
        phone: v.phone || null,
        email: v.email || null,
        streetAddress: v.streetAddress,
        suburb: v.suburb || null,
        city: v.city,
        province: v.province,
        postalCode: v.postalCode || null,
        latitude: parseNumber(v.latitude),
        longitude: parseNumber(v.longitude),
        operatingHours: hours,
        commissionPercent: toNullableNumber(v.commissionPercent),
      };
      if (store)
        return storeApi
          .update(store.id, body)
          .then((s) => ({ store: s, ownerCredentials: undefined }));
      return storeApi.create({
        ...body,
        owner: {
          email: v.ownerEmail,
          firstName: v.ownerFirstName,
          lastName: v.ownerLastName,
          phone: v.ownerPhone || undefined,
          password: v.ownerPassword || undefined,
        },
      });
    },
    meta: { silent: true },
    onSuccess: (res) => {
      toast.success(isEdit ? 'Store updated' : `${res.store.name} created`);
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
      if (res.ownerCredentials) setCreds(res.ownerCredentials);
      else onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError)
        for (const [f, m] of Object.entries(err.fieldErrors))
          form.setError(
            (f.startsWith('owner.')
              ? `owner${f[6].toUpperCase()}${f.slice(7)}`
              : f) as keyof Values,
            { message: m },
          );
      setFormError(getErrorMessage(err));
    },
  });

  const e = form.formState.errors;
  const lat = form.watch('latitude');
  const lng = form.watch('longitude');
  const pin =
    Number.isFinite(parseNumber(lat)) &&
    Number.isFinite(parseNumber(lng)) &&
    lat !== '' &&
    lng !== ''
      ? { lat: parseNumber(lat), lng: parseNumber(lng) }
      : null;

  return (
    <>
      <Modal
        open={open && !creds}
        onClose={onClose}
        busy={save.isPending}
        size="xl"
        title={isEdit ? `Edit ${store?.name}` : 'Add a hardware store'}
        description={
          isEdit
            ? undefined
            : 'Admin-created stores are approved immediately. The owner can sign in at /store/login.'
        }
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit((v) => save.mutate(v))} loading={save.isPending}>
              {isEdit ? 'Save changes' : 'Create store'}
            </Button>
          </>
        }
      >
        <form onSubmit={(ev) => ev.preventDefault()} noValidate className="space-y-8">
          {formError && <Alert>{formError}</Alert>}

          <section aria-labelledby="sf-basic" className="space-y-4">
            <h3
              id="sf-basic"
              className="text-sm font-semibold uppercase tracking-wide text-slate-500"
            >
              Store details
            </h3>
            <Input label="Store name" required error={e.name?.message} {...form.register('name')} />
            <Textarea
              label="Description"
              rows={2}
              error={e.description?.message}
              placeholder="Shown to customers"
              {...form.register('description')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                placeholder="015 123 4567"
                error={e.phone?.message}
                {...form.register('phone')}
              />
              <Input
                label="Email"
                type="email"
                error={e.email?.message}
                {...form.register('email')}
              />
            </div>
          </section>

          <section aria-labelledby="sf-address" className="space-y-4">
            <h3
              id="sf-address"
              className="text-sm font-semibold uppercase tracking-wide text-slate-500"
            >
              Address & location
            </h3>
            <Input
              label="Street address"
              required
              error={e.streetAddress?.message}
              placeholder="12 Main Road"
              {...form.register('streetAddress')}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Suburb" error={e.suburb?.message} {...form.register('suburb')} />
              <Input
                label="Town / city"
                required
                error={e.city?.message}
                {...form.register('city')}
              />
              <Input
                label="Postal code"
                inputMode="numeric"
                error={e.postalCode?.message}
                {...form.register('postalCode')}
              />
            </div>
            <Select
              label="Province"
              required
              error={e.province?.message}
              {...form.register('province')}
            >
              {SA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                leftIcon={<LocateFixed className="size-4" aria-hidden />}
                loading={geocode.isPending}
                onClick={() => geocode.mutate()}
                disabled={!form.watch('streetAddress') && !form.watch('city')}
              >
                Find on map from address
              </Button>
              {geoMessage && (
                <p role="status" className="text-sm text-slate-600">
                  {geoMessage}
                </p>
              )}
            </div>
            <MapPicker
              value={pin}
              onChange={(la, lo) => {
                form.setValue('latitude', String(la), { shouldValidate: true, shouldDirty: true });
                form.setValue('longitude', String(lo), { shouldValidate: true, shouldDirty: true });
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Latitude"
                required
                inputMode="decimal"
                error={e.latitude?.message}
                {...form.register('latitude')}
              />
              <Input
                label="Longitude"
                required
                inputMode="decimal"
                error={e.longitude?.message}
                {...form.register('longitude')}
              />
            </div>
          </section>

          <section aria-labelledby="sf-hours" className="space-y-3">
            <h3
              id="sf-hours"
              className="text-sm font-semibold uppercase tracking-wide text-slate-500"
            >
              Opening hours
            </h3>
            <HoursEditor value={hours} onChange={setHours} />
          </section>

          <section aria-labelledby="sf-commission" className="space-y-3">
            <h3
              id="sf-commission"
              className="text-sm font-semibold uppercase tracking-wide text-slate-500"
            >
              Commission
            </h3>
            <Input
              label="Commission override (%)"
              inputMode="decimal"
              placeholder="Platform default"
              hint="Leave blank to use the platform default commission (see Settings, then Commissions)."
              error={e.commissionPercent?.message}
              wrapperClassName="max-w-xs"
              {...form.register('commissionPercent')}
            />
          </section>

          {!isEdit && (
            <section aria-labelledby="sf-owner" className="space-y-4">
              <h3
                id="sf-owner"
                className="text-sm font-semibold uppercase tracking-wide text-slate-500"
              >
                Store owner account
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Owner first name"
                  required
                  error={e.ownerFirstName?.message}
                  {...form.register('ownerFirstName')}
                />
                <Input
                  label="Owner last name"
                  required
                  error={e.ownerLastName?.message}
                  {...form.register('ownerLastName')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Owner email"
                  type="email"
                  required
                  error={e.ownerEmail?.message}
                  hint="An existing account with this email is linked instead of duplicated."
                  {...form.register('ownerEmail')}
                />
                <Input
                  label="Owner mobile"
                  placeholder="082 123 4567"
                  error={e.ownerPhone?.message}
                  {...form.register('ownerPhone')}
                />
              </div>
              <PasswordInput
                label="Initial password"
                autoComplete="new-password"
                hint="Leave blank to generate a strong temporary password (shown once)."
                error={e.ownerPassword?.message}
                {...form.register('ownerPassword')}
              />
            </section>
          )}
        </form>
      </Modal>
      <CredentialsDialog
        credentials={creds}
        who="the store owner"
        onClose={() => {
          setCreds(null);
          onClose();
        }}
      />
    </>
  );
}
