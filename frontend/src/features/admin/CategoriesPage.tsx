import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { CategoryDto } from '@hardware-delivery/shared';
import { categoryApi } from '@/api/catalogue';
import { CategorySelect, flattenCategories, useCategoryTree } from '@/components/CategorySelect';
import { ImageUpload } from '@/components/ImageUpload';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Alert } from '@/components/ui/Feedback';
import { Checkbox, Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Switch } from '@/components/ui/Input';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import { CATEGORY_ICONS, categoryIcon } from '@/lib/category-icons';
import { cn } from '@/lib/cn';
import { intField } from '@/lib/form-schemas';
import { confirm } from '@/store/confirm.store';
import { toast } from '@/store/toast.store';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(100),
  parentId: z.string(),
  description: z.string().trim().max(500),
  icon: z.string(),
  sortOrder: intField('Sort order', 0, 10_000),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function CategoryFormModal({
  open,
  category,
  parentId,
  onClose,
}: {
  open: boolean;
  category: CategoryDto | null;
  parentId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CategoryDto | null>(category);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      parentId: '',
      description: '',
      icon: '',
      sortOrder: '0',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setCurrent(category);
    form.reset(
      category
        ? {
            name: category.name,
            parentId: category.parentId ?? '',
            description: category.description ?? '',
            icon: category.icon ?? '',
            sortOrder: String(category.sortOrder),
            isActive: category.isActive,
          }
        : { name: '', parentId, description: '', icon: '', sortOrder: '0', isActive: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when (re)opened
  }, [open, category?.id, parentId]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name,
        parentId: v.parentId || null,
        description: v.description || null,
        icon: v.icon || null,
        sortOrder: Number(v.sortOrder),
        isActive: v.isActive,
      };
      return current ? categoryApi.update(current.id, body) : categoryApi.create(body);
    },
    meta: { silent: true },
    onSuccess: () => {
      toast.success(current ? 'Category saved' : 'Category created');
      void qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError)
        for (const [f, m] of Object.entries(err.fieldErrors))
          form.setError(f as keyof Values, { message: m });
      setFormError(getErrorMessage(err));
    },
  });

  const e = form.formState.errors;
  const icon = form.watch('icon');
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={save.isPending}
      title={category ? 'Edit category' : parentId ? 'New sub-category' : 'New category'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit((v) => save.mutate(v))} loading={save.isPending}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <form onSubmit={(ev) => ev.preventDefault()} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        <Input label="Name" required error={e.name?.message} {...form.register('name')} />
        <CategorySelect
          admin
          label="Parent category"
          emptyLabel="None (top level)"
          excludeSubtreeOf={category?.id}
          error={e.parentId?.message}
          {...form.register('parentId')}
        />
        <Textarea
          label="Description"
          rows={2}
          error={e.description?.message}
          {...form.register('description')}
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Icon</legend>
          <div
            className="grid grid-cols-8 gap-1.5 sm:grid-cols-10"
            role="radiogroup"
            aria-label="Category icon"
          >
            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
              <label
                key={key}
                title={key}
                className={cn(
                  'flex aspect-square cursor-pointer items-center justify-center rounded-lg border text-slate-600',
                  icon === key
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <input
                  type="radio"
                  value={key}
                  className="sr-only"
                  aria-label={key}
                  {...form.register('icon')}
                />
                <Icon className="size-5" aria-hidden />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Sort order"
            inputMode="numeric"
            hint="Lower numbers appear first"
            error={e.sortOrder?.message}
            {...form.register('sortOrder')}
          />
        </div>
        <Checkbox
          label="Active"
          hint="Inactive categories (and everything below them) are hidden from customers."
          {...form.register('isActive')}
        />
        {current && (
          <ImageUpload
            label="Category image"
            imageUrl={current.imageUrl}
            onUpload={async (f) => {
              setCurrent(await categoryApi.setImage(current.id, f));
              void qc.invalidateQueries({ queryKey: ['categories'] });
            }}
          />
        )}
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const tree = useCategoryTree(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ category: CategoryDto | null; parentId: string } | null>(null);

  const rows = useMemo(() => {
    const out: Array<CategoryDto & { depth: number; hasChildren: boolean }> = [];
    const walk = (nodes: CategoryDto[], depth: number, inheritedIcon: string | null) => {
      for (const n of nodes) {
        const icon = n.icon ?? inheritedIcon; // sub-categories show their parent's icon unless they have their own
        out.push({ ...n, icon, depth, hasChildren: (n.children?.length ?? 0) > 0 });
        if (!collapsed.has(n.id)) walk(n.children ?? [], depth + 1, icon);
      }
    };
    walk(tree.data ?? [], 0, null);
    return out;
  }, [tree.data, collapsed]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ['categories'] });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      categoryApi.update(id, { isActive }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => categoryApi.remove(id),
    meta: { successMessage: 'Category deleted' },
    onSuccess: refresh,
  });
  const total = flattenCategories(tree.data ?? []).length;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Category',
      cell: (c) => {
        const Icon = categoryIcon(c.icon);
        return (
          <div className="flex items-center gap-2" style={{ paddingLeft: c.depth * 24 }}>
            {c.hasChildren ? (
              <button
                type="button"
                aria-label={`${collapsed.has(c.id) ? 'Expand' : 'Collapse'} ${c.name}`}
                aria-expanded={!collapsed.has(c.id)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                onClick={() =>
                  setCollapsed((s) => {
                    const n = new Set(s);
                    if (n.has(c.id)) n.delete(c.id);
                    else n.add(c.id);
                    return n;
                  })
                }
              >
                <ChevronRight
                  className={cn('size-4 transition-transform', !collapsed.has(c.id) && 'rotate-90')}
                  aria-hidden
                />
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="font-medium text-slate-900">{c.name}</span>
            {!c.isActive && <Badge tone="neutral">Inactive</Badge>}
          </div>
        );
      },
    },
    {
      key: 'slug',
      header: 'Slug',
      hideBelow: 'lg',
      cell: (c) => <span className="font-mono text-xs text-slate-500">{c.slug}</span>,
    },
    {
      key: 'count',
      header: 'Listings',
      align: 'right',
      hideBelow: 'sm',
      cell: (c) => <span className="tabular-nums">{c.listingCount ?? 0}</span>,
    },
    {
      key: 'order',
      header: 'Order',
      align: 'right',
      hideBelow: 'md',
      cell: (c) => <span className="tabular-nums text-slate-500">{c.sortOrder}</span>,
    },
    {
      key: 'active',
      header: 'Active',
      align: 'center',
      cell: (c) => (
        <Switch
          checked={c.isActive}
          label={`${c.name} active`}
          onChange={(isActive) => toggle.mutate({ id: c.id, isActive })}
        />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={`Add a sub-category to ${c.name}`}
            title="Add sub-category"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => setForm({ category: null, parentId: c.id })}
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Edit ${c.name}`}
            title="Edit"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => setForm({ category: c, parentId: '' })}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete ${c.name}`}
            title="Delete"
            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
            onClick={async () => {
              if (
                await confirm({
                  title: `Delete “${c.name}”?`,
                  message: 'Only empty categories (no sub-categories or products) can be deleted.',
                  confirmLabel: 'Delete',
                  tone: 'danger',
                })
              )
                remove.mutate(c.id);
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
        title="Categories"
        description={`${total} categories in a tree customers use to browse.`}
        actions={
          <Button
            leftIcon={<Plus className="size-4" aria-hidden />}
            onClick={() => setForm({ category: null, parentId: '' })}
          >
            Add category
          </Button>
        }
      />
      <DataTable
        caption="Product categories"
        columns={columns}
        data={{ data: rows }}
        rowKey={(c) => c.id}
        loading={tree.isLoading}
        error={tree.error}
        onRetry={() => tree.refetch()}
        emptyTitle="No categories yet"
        emptyDescription="Create top-level categories such as Building Materials, Plumbing or Tools, then add sub-categories."
      />
      <CategoryFormModal
        open={!!form}
        category={form?.category ?? null}
        parentId={form?.parentId ?? ''}
        onClose={() => setForm(null)}
      />
    </div>
  );
}
