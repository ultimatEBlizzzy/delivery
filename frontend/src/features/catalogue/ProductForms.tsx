import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PRODUCT_UNITS, type ProductDto, type ProductImageDto } from '@hardware-delivery/shared';
import { productApi, type ProductInput } from '@/api/catalogue';
import { CategorySelect } from '@/components/CategorySelect';
import { ImageUpload } from '@/components/ImageUpload';
import { Alert } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import {
  decimalField,
  numToField,
  optionalDecimalField,
  parseNumber,
  toNullableNumber,
} from '@/lib/form-schemas';
import { confirm } from '@/store/confirm.store';
import { toast } from '@/store/toast.store';
import type { Scope } from './ListingForms';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the product name').max(200, 'At most 200 characters'),
  sku: z
    .string()
    .trim()
    .min(2, 'Enter a SKU')
    .max(60, 'At most 60 characters')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, numbers, dots, dashes and underscores'),
  categoryId: z.string().min(1, 'Choose a category'),
  brand: z.string().trim().max(100),
  unit: z.string().min(1, 'Choose a unit'),
  packSize: z.string().trim().max(60),
  weightKg: decimalField('Weight', 0, 50_000, 3),
  lengthCm: optionalDecimalField('Length'),
  widthCm: optionalDecimalField('Width'),
  heightCm: optionalDecimalField('Height'),
  description: z.string().trim().max(5000, 'At most 5000 characters'),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: '',
  sku: '',
  categoryId: '',
  brand: '',
  unit: 'each',
  packSize: '',
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  description: '',
  isActive: true,
};

const toValues = (p: ProductDto): Values => ({
  name: p.name,
  sku: p.sku,
  categoryId: p.category.id,
  brand: p.brand ?? '',
  unit: p.unit,
  packSize: p.packSize ?? '',
  weightKg: numToField(p.weightKg),
  lengthCm: numToField(p.lengthCm),
  widthCm: numToField(p.widthCm),
  heightCm: numToField(p.heightCm),
  description: p.description ?? '',
  isActive: p.isActive,
});

const toInput = (v: Values): ProductInput => ({
  name: v.name,
  sku: v.sku,
  categoryId: v.categoryId,
  brand: v.brand || null,
  unit: v.unit,
  packSize: v.packSize || null,
  weightKg: parseNumber(v.weightKg),
  lengthCm: toNullableNumber(v.lengthCm),
  widthCm: toNullableNumber(v.widthCm),
  heightCm: toNullableNumber(v.heightCm),
  description: v.description || null,
  isActive: v.isActive,
});

function ImagesManager({
  product,
  scope,
  onChange,
}: {
  product: ProductDto;
  scope: Scope;
  onChange: (images: ProductImageDto[]) => void;
}) {
  const images = product.images;
  return (
    <section aria-labelledby="images-heading" className="space-y-3">
      <h3 id="images-heading" className="text-sm font-semibold text-slate-900">
        Photos
      </h3>
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200"
            >
              <img
                src={img.url}
                alt={img.alt ?? product.name}
                className="aspect-square w-full object-cover"
              />
              {img.isPrimary && (
                <Badge tone="brand" className="absolute left-2 top-2">
                  Main photo
                </Badge>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {scope === 'admin' && !img.isPrimary ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-800"
                    onClick={async () =>
                      onChange(await productApi.setPrimaryImage(product.id, img.id))
                    }
                  >
                    <Star className="size-3.5" aria-hidden /> Make main
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  aria-label="Delete photo"
                  className="rounded-md bg-white/90 p-1.5 text-red-600"
                  onClick={async () => {
                    if (
                      !(await confirm({
                        title: 'Delete this photo?',
                        confirmLabel: 'Delete',
                        tone: 'danger',
                      }))
                    )
                      return;
                    await productApi.removeImage(product.id, img.id, scope);
                    onChange(
                      images
                        .filter((i) => i.id !== img.id)
                        .map((i, idx) =>
                          img.isPrimary && idx === 0 ? { ...i, isPrimary: true } : i,
                        ),
                    );
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length < 8 && (
        <ImageUpload
          label={images.length ? 'Add another photo' : 'Add a photo'}
          onUpload={async (file) =>
            onChange([...images, await productApi.addImage(product.id, file, scope)])
          }
          hint="Up to 8 photos. The first one becomes the main photo."
        />
      )}
    </section>
  );
}

/** Create or edit a global catalogue product. After creating, the modal stays open so photos can be added. */
export function ProductFormModal({
  scope,
  open,
  product,
  onClose,
  onSaved,
}: {
  scope: Scope;
  open: boolean;
  product?: ProductDto | null;
  onClose: () => void;
  onSaved?: (product: ProductDto) => void;
}) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState<ProductDto | null>(product ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = !!current;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    setCurrent(product ?? null);
    setFormError(null);
    form.reset(product ? toValues(product) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when (re)opened or a different product is passed
  }, [open, product?.id]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = toInput(v);
      if (current)
        return scope === 'admin'
          ? productApi.update(current.id, body)
          : productApi.storeUpdate(current.id, body);
      return scope === 'admin' ? productApi.create(body) : productApi.storeCreate(body);
    },
    meta: { silent: true },
    onSuccess: (saved, v) => {
      const wasCreate = !current;
      toast.success(wasCreate ? 'Product created – you can add photos now' : 'Product saved');
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
      setCurrent(saved);
      form.reset(toValues(saved));
      onSaved?.(saved);
      if (!wasCreate) onClose();
      void v;
    },
    onError: (err) => {
      if (err instanceof ApiError)
        for (const [f, m] of Object.entries(err.fieldErrors))
          form.setError(f as keyof Values, { message: m });
      setFormError(getErrorMessage(err));
    },
  });

  const errors = form.formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={save.isPending}
      size="xl"
      title={isEdit ? 'Edit product' : 'New product'}
      description={
        isEdit
          ? undefined
          : 'Product details are shared by every store that lists it. Each store sets its own price and stock.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {isEdit && !form.formState.isDirty ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={form.handleSubmit((v) => save.mutate(v))}
            loading={save.isPending}
            disabled={isEdit && !form.formState.isDirty}
          >
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
        {formError && <Alert>{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Product name"
            required
            error={errors.name?.message}
            wrapperClassName="sm:col-span-2"
            placeholder="Cement 42.5R 50kg"
            {...form.register('name')}
          />
          <Input
            label="SKU"
            required
            error={errors.sku?.message}
            hint="Unique across the whole catalogue"
            placeholder="CEM-425R-50"
            {...form.register('sku')}
          />
          <CategorySelect
            admin={scope === 'admin'}
            label="Category"
            required
            emptyLabel="Choose a category…"
            error={errors.categoryId?.message}
            {...form.register('categoryId')}
          />
          <Input
            label="Brand"
            error={errors.brand?.message}
            placeholder="Optional"
            {...form.register('brand')}
          />
          <Select label="Sold per" required error={errors.unit?.message} {...form.register('unit')}>
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Input
            label="Pack description"
            error={errors.packSize?.message}
            placeholder="e.g. 50 kg bag"
            {...form.register('packSize')}
          />
          <Input
            label="Weight of one unit (kg)"
            required
            inputMode="decimal"
            error={errors.weightKg?.message}
            hint="Used to choose a vehicle that can carry the order"
            {...form.register('weightKg')}
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">
            Size of one unit (cm) – optional
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Length"
              hideLabel
              inputMode="decimal"
              placeholder="Length"
              error={errors.lengthCm?.message}
              {...form.register('lengthCm')}
            />
            <Input
              label="Width"
              hideLabel
              inputMode="decimal"
              placeholder="Width"
              error={errors.widthCm?.message}
              {...form.register('widthCm')}
            />
            <Input
              label="Height"
              hideLabel
              inputMode="decimal"
              placeholder="Height"
              error={errors.heightCm?.message}
              {...form.register('heightCm')}
            />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Long items (pipes, timber, roof sheets) need a vehicle that is long enough.
          </p>
        </fieldset>
        <Textarea
          label="Description"
          rows={3}
          error={errors.description?.message}
          placeholder="Optional – what is it, what is it for?"
          {...form.register('description')}
        />
        {scope === 'admin' && (
          <Checkbox
            label="Active"
            hint="Inactive products are hidden from customers in every store."
            {...form.register('isActive')}
          />
        )}
      </form>
      {current && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <ImagesManager
            product={current}
            scope={scope}
            onChange={(images) => {
              setCurrent({
                ...current,
                images,
                primaryImageUrl: images.find((i) => i.isPrimary)?.url ?? images[0]?.url ?? null,
              });
              void qc.invalidateQueries({ queryKey: ['products'] });
              void qc.invalidateQueries({ queryKey: ['listings'] });
            }}
          />
        </div>
      )}
    </Modal>
  );
}
