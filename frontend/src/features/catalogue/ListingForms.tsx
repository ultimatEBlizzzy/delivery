import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { InventoryReason, type ListingDto } from '@hardware-delivery/shared';
import { listingApi, type ListingUpdate } from '@/api/catalogue';
import { ProductThumb } from '@/components/ProductThumb';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  intField,
  moneyField,
  numToField,
  optionalIntField,
  optionalMoneyField,
  parseNumber,
  saleBelowPrice,
  toNullableNumber,
} from '@/lib/form-schemas';
import { toast } from '@/store/toast.store';

export type Scope = 'admin' | 'store';

// ---------------------------------------------------------------------------------------------
// Listing details (price, sale price, quantity limits, availability)
// ---------------------------------------------------------------------------------------------
export const listingFields = {
  price: moneyField('Price'),
  salePrice: optionalMoneyField('Sale price'),
  minimumQuantity: intField('Minimum order quantity', 1, 100_000),
  maximumQuantity: optionalIntField('Maximum order quantity', 1),
  lowStockThreshold: intField('Low-stock alert level', 0, 1_000_000),
  storeSku: z.string().trim().max(60, 'At most 60 characters'),
  available: z.boolean(),
};

type ListingCheck = {
  price: string;
  salePrice: string;
  minimumQuantity: string;
  maximumQuantity: string;
};
/** Cross-field rules (used with .refine on every form that edits a listing). */
export const saleIsLower = (v: ListingCheck) => saleBelowPrice(v.price, v.salePrice);
export const maxAtLeastMin = (v: ListingCheck) =>
  v.maximumQuantity === '' || Number(v.maximumQuantity) >= Number(v.minimumQuantity);
export const SALE_MESSAGE = {
  path: ['salePrice'],
  message: 'Sale price must be lower than the regular price',
};
export const MAX_MESSAGE = {
  path: ['maximumQuantity'],
  message: 'Maximum cannot be lower than the minimum',
};

const editSchema = z
  .object(listingFields)
  .refine(saleIsLower, SALE_MESSAGE)
  .refine(maxAtLeastMin, MAX_MESSAGE);
export type EditValues = z.infer<typeof editSchema>;

export function listingToPayload(v: EditValues): ListingUpdate {
  return {
    price: parseNumber(v.price),
    salePrice: toNullableNumber(v.salePrice),
    minimumQuantity: Number(v.minimumQuantity),
    maximumQuantity: v.maximumQuantity === '' ? null : Number(v.maximumQuantity),
    lowStockThreshold: Number(v.lowStockThreshold),
    storeSku: v.storeSku || null,
    available: v.available,
  };
}

/** The price/quantity inputs shared by "edit listing" and "add listing". */
export function ListingFieldset({
  register,
  errors,
  salePreview,
}: {
  register: UseFormRegister<EditValues>;
  errors: FieldErrors<EditValues>;
  salePreview?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Price (R)"
          inputMode="decimal"
          placeholder="109.99"
          required
          error={errors.price?.message}
          hint="What a customer pays per unit, VAT included."
          {...register('price')}
        />
        <Input
          label="Sale price (R)"
          inputMode="decimal"
          placeholder="99.99"
          error={errors.salePrice?.message}
          hint={salePreview ?? 'Optional. Must be lower than the price.'}
          {...register('salePrice')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Minimum order"
          inputMode="numeric"
          required
          error={errors.minimumQuantity?.message}
          {...register('minimumQuantity')}
        />
        <Input
          label="Maximum order"
          inputMode="numeric"
          placeholder="No limit"
          error={errors.maximumQuantity?.message}
          {...register('maximumQuantity')}
        />
        <Input
          label="Low-stock alert at"
          inputMode="numeric"
          required
          error={errors.lowStockThreshold?.message}
          {...register('lowStockThreshold')}
        />
      </div>
      <Input
        label="Your SKU / shelf code"
        placeholder="Optional"
        error={errors.storeSku?.message}
        {...register('storeSku')}
      />
      <Checkbox
        label="Available to customers"
        hint="Untick to hide this product from customers without deleting it."
        {...register('available')}
      />
    </div>
  );
}

export function EditListingModal({
  scope,
  listing,
  onClose,
}: {
  scope: Scope;
  listing: ListingDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const api = listingApi(scope);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (!listing) return;
    setFormError(null);
    form.reset({
      price: numToField(listing.price),
      salePrice: numToField(listing.salePrice),
      minimumQuantity: String(listing.minimumQuantity),
      maximumQuantity: numToField(listing.maximumQuantity),
      lowStockThreshold: String(listing.lowStockThreshold),
      storeSku: listing.storeSku ?? '',
      available: listing.available,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when a different listing is opened
  }, [listing?.id]);

  const save = useMutation({
    mutationFn: (v: EditValues) => api.update(listing!.id, listingToPayload(v)),
    meta: { silent: true },
    onSuccess: () => {
      toast.success('Listing updated');
      void qc.invalidateQueries({ queryKey: ['listings'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError)
        for (const [f, m] of Object.entries(err.fieldErrors))
          form.setError(f as keyof EditValues, { message: m });
      setFormError(getErrorMessage(err));
    },
  });

  return (
    <Modal
      open={!!listing}
      onClose={onClose}
      busy={save.isPending}
      title="Edit listing"
      description={
        listing
          ? `${listing.product.name}${listing.store ? ` · ${listing.store.name}` : ''}`
          : undefined
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit((v) => save.mutate(v))} loading={save.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      {listing && (
        <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <ProductThumb src={listing.product.primaryImageUrl} className="size-12" />
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold text-slate-900">{listing.product.name}</p>
              <p className="text-slate-500">
                {listing.product.sku} · {listing.product.packSize ?? listing.product.unit} ·{' '}
                {listing.stockQuantity} in stock
              </p>
            </div>
          </div>
          <ListingFieldset register={form.register} errors={form.formState.errors} />
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Stock adjustment (always goes through the inventory ledger)
// ---------------------------------------------------------------------------------------------
const MODES = [
  { id: 'ADD', label: 'Add stock', reason: InventoryReason.RESTOCK },
  { id: 'REMOVE', label: 'Remove stock', reason: InventoryReason.CORRECTION },
  { id: 'SET', label: 'Set exact level', reason: InventoryReason.ADJUSTMENT },
] as const;

const REASONS: Array<{ value: InventoryReason; label: string }> = [
  { value: InventoryReason.RESTOCK, label: 'Restock / delivery from supplier' },
  { value: InventoryReason.CORRECTION, label: 'Correction (damaged, lost, miscounted)' },
  { value: InventoryReason.ADJUSTMENT, label: 'Stock-take adjustment' },
];

export function StockAdjustModal({
  scope,
  listing,
  onClose,
}: {
  scope: Scope;
  listing: ListingDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const api = listingApi(scope);
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('ADD');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<InventoryReason>(InventoryReason.RESTOCK);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listing) return;
    setMode('ADD');
    setQuantity('');
    setReason(InventoryReason.RESTOCK);
    setNote('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a different listing is opened
  }, [listing?.id]);

  const qty = /^\d+$/.test(quantity) ? Number(quantity) : null;
  const current = listing?.stockQuantity ?? 0;
  const next =
    qty === null ? null : mode === 'ADD' ? current + qty : mode === 'REMOVE' ? current - qty : qty;
  const problem =
    qty === null
      ? 'Enter a whole number'
      : mode !== 'SET' && qty < 1
        ? 'Enter at least 1'
        : next !== null && next < 0
          ? `You only have ${current} in stock`
          : null;

  const save = useMutation({
    mutationFn: () =>
      api.adjustStock(listing!.id, {
        mode,
        quantity: qty!,
        reason,
        note: note.trim() || undefined,
      }),
    meta: { silent: true },
    onSuccess: (updated) => {
      toast.success(`Stock updated – ${updated.stockQuantity} in stock`);
      void qc.invalidateQueries({ queryKey: ['listings'] });
      void qc.invalidateQueries({ queryKey: ['movements'] });
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <Modal
      open={!!listing}
      onClose={onClose}
      busy={save.isPending}
      title="Adjust stock"
      description={listing?.product.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!!problem}>
            Update stock
          </Button>
        </>
      }
    >
      {listing && (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">What happened?</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {MODES.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors',
                    mode === m.id
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    className="sr-only"
                    checked={mode === m.id}
                    onChange={() => {
                      setMode(m.id);
                      setReason(m.reason);
                    }}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Input
            label={mode === 'SET' ? 'New stock level' : 'Quantity'}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.trim())}
            autoFocus
            error={quantity !== '' ? (problem ?? undefined) : undefined}
            hint={`Currently ${current} in stock`}
          />
          {next !== null && !problem && (
            <p
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
              role="status"
            >
              <span className="tabular-nums">{current}</span>
              <ArrowRight className="size-4 text-slate-400" aria-label="becomes" />
              <strong className="tabular-nums">{next}</strong> in stock
            </p>
          )}
          <Select
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as InventoryReason)}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Note"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional – e.g. invoice number"
          />
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Stock history (ledger)
// ---------------------------------------------------------------------------------------------
const REASON_LABELS: Record<string, string> = {
  INITIAL_STOCK: 'Opening stock',
  RESTOCK: 'Restock',
  ADJUSTMENT: 'Stock-take',
  CORRECTION: 'Correction',
  SALE: 'Sold',
  ORDER_CANCELLED: 'Order cancelled',
};

export function MovementsModal({
  scope,
  listing,
  onClose,
}: {
  scope: Scope;
  listing: ListingDto | null;
  onClose: () => void;
}) {
  const api = listingApi(scope);
  const query = useQuery({
    queryKey: ['movements', scope, listing?.id],
    queryFn: () => api.movements({ storeProductId: listing!.id, limit: 50 }),
    enabled: !!listing,
  });
  return (
    <Modal
      open={!!listing}
      onClose={onClose}
      title="Stock history"
      description={
        listing ? `${listing.product.name} · ${listing.stockQuantity} in stock now` : undefined
      }
      size="lg"
    >
      {query.isError ? (
        <Alert>{getErrorMessage(query.error)}</Alert>
      ) : !query.data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : query.data.data.length === 0 ? (
        <EmptyState title="No stock movements yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Stock movements, newest first</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-4">
                  When
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  Change
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  Level after
                </th>
                <th scope="col" className="py-2 pr-4">
                  Reason
                </th>
                <th scope="col" className="py-2">
                  By / note
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data.data.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                    {formatDateTime(m.createdAt)}
                  </td>
                  <td
                    className={cn(
                      'py-2 pr-4 text-right font-semibold tabular-nums',
                      m.change > 0 ? 'text-emerald-600' : 'text-red-600',
                    )}
                  >
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.quantityAfter}</td>
                  <td className="py-2 pr-4">{REASON_LABELS[m.reason] ?? m.reason}</td>
                  <td className="py-2 text-slate-600">
                    {m.actorName ?? (m.orderId ? 'Customer order' : 'System')}
                    {m.note && <span className="block text-xs text-slate-500">{m.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** Price cell: sale price highlighted, regular price struck through. */
export function PriceCell({
  listing,
}: {
  listing: Pick<ListingDto, 'price' | 'salePrice' | 'onSale'>;
}) {
  return listing.onSale ? (
    <span className="whitespace-nowrap">
      <span className="font-semibold text-slate-900">{formatMoney(listing.salePrice)}</span>
      <span className="ml-1.5 text-xs text-slate-400 line-through">
        {formatMoney(listing.price)}
      </span>
    </span>
  ) : (
    <span className="whitespace-nowrap font-semibold text-slate-900">
      {formatMoney(listing.price)}
    </span>
  );
}
