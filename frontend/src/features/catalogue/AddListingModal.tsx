import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import type { CatalogueProductDto, ProductDto } from '@hardware-delivery/shared';
import { listingApi, productApi } from '@/api/catalogue';
import { ProductThumb } from '@/components/ProductThumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import { intField } from '@/lib/form-schemas';
import { toast } from '@/store/toast.store';
import {
  EditValues,
  ListingFieldset,
  listingFields,
  listingToPayload,
  maxAtLeastMin,
  MAX_MESSAGE,
  SALE_MESSAGE,
  saleIsLower,
  type Scope,
} from './ListingForms';
import { ProductFormModal } from './ProductForms';

const createSchema = z
  .object({ ...listingFields, stockQuantity: intField('Opening stock', 0) })
  .refine(saleIsLower, SALE_MESSAGE)
  .refine(maxAtLeastMin, MAX_MESSAGE);
type CreateValues = z.infer<typeof createSchema>;

const DEFAULTS: CreateValues = {
  price: '',
  salePrice: '',
  minimumQuantity: '1',
  maximumQuantity: '',
  lowStockThreshold: '5',
  storeSku: '',
  available: true,
  stockQuantity: '0',
};

type Picked = Pick<
  ProductDto,
  'id' | 'name' | 'sku' | 'brand' | 'unit' | 'packSize' | 'primaryImageUrl'
>;

/**
 * Two steps: (1) find the product in the shared catalogue – or create it if it is missing,
 * (2) set this store's own price, stock and order limits.
 */
export function AddListingModal({
  scope,
  storeId,
  open,
  onClose,
}: {
  scope: Scope;
  storeId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ProductDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setPicked(null);
    setSearch('');
    setPage(1);
    setFormError(null);
    form.reset(DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time the dialog opens
  }, [open]);

  const results = useQuery({
    queryKey: ['products', 'picker', scope, search, page],
    queryFn: async (): Promise<{
      data: Array<Picked & { category: { name: string }; listedByStore?: boolean }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    }> => {
      if (scope === 'store') return productApi.storeSearch({ search, page, limit: 6 });
      return productApi.adminList({ search, page, limit: 6, isActive: true });
    },
    enabled: open && step === 'pick',
    placeholderData: (prev) => prev,
  });

  const create = useMutation({
    mutationFn: (v: CreateValues) =>
      listingApi(scope).create({
        productId: picked!.id,
        ...(scope === 'admin' ? { storeId } : {}),
        ...(listingToPayload(v as EditValues) as { price: number }),
        stockQuantity: Number(v.stockQuantity),
      }),
    meta: { silent: true },
    onSuccess: () => {
      toast.success(`${picked?.name} added to the store`);
      void qc.invalidateQueries({ queryKey: ['listings'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError)
        for (const [f, m] of Object.entries(err.fieldErrors))
          form.setError(f as keyof CreateValues, { message: m });
      setFormError(getErrorMessage(err));
    },
  });

  const choose = (p: Picked) => {
    setPicked(p);
    setFormError(null);
    setStep('details');
  };

  return (
    <>
      <Modal
        open={open && !creating}
        onClose={onClose}
        busy={create.isPending}
        size="lg"
        title={step === 'pick' ? 'Add a product' : 'Set price and stock'}
        description={
          step === 'pick'
            ? 'Search the shared catalogue first so products are not duplicated.'
            : picked?.name
        }
        footer={
          step === 'pick' ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                leftIcon={<Plus className="size-4" aria-hidden />}
                onClick={() => setCreating(true)}
              >
                Create a new product
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="size-4" aria-hidden />}
                onClick={() => setStep('pick')}
                disabled={create.isPending}
              >
                Back
              </Button>
              <Button
                onClick={form.handleSubmit((v) => create.mutate(v))}
                loading={create.isPending}
              >
                Add to store
              </Button>
            </>
          )
        }
      >
        {step === 'pick' ? (
          <div className="space-y-4">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by name, brand or SKU…"
              label="Search the catalogue"
            />
            {results.isError ? (
              <Alert>{getErrorMessage(results.error)}</Alert>
            ) : !results.data ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : results.data.data.length === 0 ? (
              <EmptyState
                title="No matching products"
                description="If your product is not in the catalogue yet, create it – other stores will be able to list it too."
              />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {results.data.data.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-3">
                    <ProductThumb src={p.primaryImageUrl} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{p.name}</p>
                      <p className="truncate text-sm text-slate-500">
                        {[p.brand, p.sku, p.packSize ?? p.unit, p.category.name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {(p as CatalogueProductDto).listedByStore ? (
                      <Badge tone="success">Already listed</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => choose(p)}>
                        Select
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {results.data && results.data.meta.totalPages > 1 && (
              <Pagination meta={results.data.meta} onPageChange={setPage} />
            )}
          </div>
        ) : (
          <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-4">
            {formError && <Alert>{formError}</Alert>}
            <ListingFieldset
              register={form.register as unknown as UseFormRegister<EditValues>}
              errors={form.formState.errors}
            />
            <Input
              label="Opening stock"
              inputMode="numeric"
              required
              error={form.formState.errors.stockQuantity?.message}
              hint="How many you have right now. Recorded in the stock history."
              {...form.register('stockQuantity')}
            />
          </form>
        )}
      </Modal>
      <ProductFormModal
        scope={scope}
        open={open && creating}
        onClose={() => {
          setCreating(false);
          // the product dialog stays open after saving so photos can be added; moving on happens when it is closed
          if (created) {
            choose(created);
            setCreated(null);
          }
        }}
        onSaved={setCreated}
      />
    </>
  );
}
