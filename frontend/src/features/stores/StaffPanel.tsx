import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { StoreStaffRole, type StoreStaffDto } from '@hardware-delivery/shared';
import { storeApi, type StaffInput } from '@/api/stores';
import { CredentialsDialog } from '@/components/CredentialsDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Alert } from '@/components/ui/Feedback';
import { Input, PasswordInput, Select, Switch } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import { useQueryParams } from '@/hooks/useQueryParams';
import { confirm } from '@/store/confirm.store';
import { emailSchema, optionalPhoneSchema } from '@/features/auth/schemas';
import { toast } from '@/store/toast.store';
import { StoreSelect } from './StoreSelect';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_REGEX } from '@hardware-delivery/shared';

const ROLE_HELP: Record<StoreStaffRole, string> = {
  OWNER: 'Everything, including staff and store settings',
  MANAGER: 'Products, prices, stock, orders and opening hours',
  STAFF: 'Orders and stock adjustments only',
};

const schema = z.object({
  storeId: z.string(),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: emailSchema,
  phone: optionalPhoneSchema,
  role: z.enum([StoreStaffRole.OWNER, StoreStaffRole.MANAGER, StoreStaffRole.STAFF]),
  password: z
    .string()
    .refine((v) => v === '' || (v.length >= 8 && PASSWORD_REGEX.test(v)), PASSWORD_POLICY_MESSAGE),
});
type Values = z.infer<typeof schema>;

function AddStaffModal({
  scope,
  storeId,
  open,
  onClose,
}: {
  scope: 'admin' | 'store';
  storeId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const needsStore = scope === 'admin' && !storeId;
  const form = useForm<Values>({
    resolver: zodResolver(
      schema.refine((v) => !needsStore || v.storeId !== '', {
        path: ['storeId'],
        message: 'Choose a store',
      }),
    ),
    defaultValues: {
      storeId: storeId ?? '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: StoreStaffRole.STAFF,
      password: '',
    },
  });

  const add = useMutation({
    mutationFn: (v: Values) => {
      const body: StaffInput = {
        email: v.email,
        firstName: v.firstName,
        lastName: v.lastName,
        phone: v.phone || undefined,
        role: v.role,
        password: v.password || undefined,
      };
      return scope === 'admin'
        ? storeApi.adminAddStaff(storeId ?? v.storeId, body)
        : storeApi.myAddStaff(body);
    },
    meta: { silent: true },
    onSuccess: (res, v) => {
      toast.success(`${res.staff.firstName} ${res.staff.lastName} added`);
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stores'] });
      form.reset({
        storeId: storeId ?? '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: StoreStaffRole.STAFF,
        password: '',
      });
      void v;
      if (res.temporaryPassword)
        setCreds({ email: res.staff.email, temporaryPassword: res.temporaryPassword });
      else onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError)
        for (const [f, m] of Object.entries(err.fieldErrors))
          form.setError(f as keyof Values, { message: m });
      setFormError(getErrorMessage(err));
    },
  });
  const e = form.formState.errors;
  return (
    <>
      <Modal
        open={open && !creds}
        onClose={onClose}
        busy={add.isPending}
        title="Add a staff member"
        description="If the email already has an account it is linked to the store; otherwise a new account is created."
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={add.isPending}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit((v) => add.mutate(v))} loading={add.isPending}>
              Add staff member
            </Button>
          </>
        }
      >
        <form onSubmit={(ev) => ev.preventDefault()} noValidate className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          {needsStore && (
            <StoreSelect
              label="Store"
              required
              emptyLabel="Choose a store…"
              error={e.storeId?.message}
              {...form.register('storeId')}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              required
              error={e.firstName?.message}
              {...form.register('firstName')}
            />
            <Input
              label="Last name"
              required
              error={e.lastName?.message}
              {...form.register('lastName')}
            />
          </div>
          <Input
            label="Email address"
            type="email"
            required
            error={e.email?.message}
            {...form.register('email')}
          />
          <Input
            label="Mobile number"
            placeholder="082 123 4567"
            error={e.phone?.message}
            {...form.register('phone')}
          />
          <Select
            label="Role"
            hint={ROLE_HELP[form.watch('role')]}
            error={e.role?.message}
            {...form.register('role')}
          >
            <option value={StoreStaffRole.STAFF}>Staff</option>
            <option value={StoreStaffRole.MANAGER}>Manager</option>
            <option value={StoreStaffRole.OWNER}>Owner</option>
          </Select>
          <PasswordInput
            label="Initial password"
            autoComplete="new-password"
            hint="Leave blank to generate a strong temporary password (shown once). Ignored for existing accounts."
            error={e.password?.message}
            {...form.register('password')}
          />
        </form>
      </Modal>
      <CredentialsDialog
        credentials={creds}
        who="the new staff member"
        onClose={() => {
          setCreds(null);
          onClose();
        }}
      />
    </>
  );
}

/** Staff of one store (store portal or admin store page) or of all stores (admin "Store staff" page). */
export function StaffPanel({
  scope,
  storeId,
  canManage = true,
}: {
  scope: 'admin' | 'store';
  storeId?: string;
  canManage?: boolean;
}) {
  const qc = useQueryClient();
  const [params, setParams] = useQueryParams({ page: 1, search: '', storeId: '' });
  const [adding, setAdding] = useState(false);
  const effectiveStore = storeId ?? (params.storeId || undefined);

  const query = useQuery({
    queryKey: ['staff', scope, effectiveStore, params.page, params.search],
    queryFn: () =>
      scope === 'admin'
        ? storeApi.adminStaff({
            page: params.page,
            limit: 15,
            search: params.search || undefined,
            storeId: effectiveStore,
          })
        : storeApi.myStaff({ page: params.page, limit: 15, search: params.search || undefined }),
    placeholderData: (prev) => prev,
  });

  const update = useMutation({
    mutationFn: ({
      row,
      body,
    }: {
      row: StoreStaffDto;
      body: { role?: StoreStaffRole; isActive?: boolean };
    }) =>
      scope === 'admin'
        ? storeApi.adminUpdateStaff(row.storeId, row.id, body)
        : storeApi.myUpdateStaff(row.id, body),
    meta: { successMessage: 'Staff member updated' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff'] }),
  });
  const remove = useMutation({
    mutationFn: (row: StoreStaffDto) =>
      scope === 'admin'
        ? storeApi.adminRemoveStaff(row.storeId, row.id)
        : storeApi.myRemoveStaff(row.id),
    meta: { successMessage: 'Staff member removed' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const columns: Column<StoreStaffDto>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {r.firstName} {r.lastName}
          </p>
          <p className="truncate text-xs text-slate-500">{r.email}</p>
        </div>
      ),
    },
    ...(scope === 'admin' && !storeId
      ? [
          {
            key: 'store',
            header: 'Store',
            hideBelow: 'md' as const,
            cell: (r: StoreStaffDto) => r.storeName ?? '–',
          },
        ]
      : []),
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (r) => r.phone ?? '–' },
    {
      key: 'role',
      header: 'Role',
      cell: (r) =>
        canManage ? (
          <Select
            hideLabel
            label={`Role of ${r.firstName} ${r.lastName}`}
            value={r.role}
            onChange={(e) =>
              update.mutate({ row: r, body: { role: e.target.value as StoreStaffRole } })
            }
            wrapperClassName="w-32"
            className="h-9"
          >
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </Select>
        ) : (
          <Badge tone={r.role === 'OWNER' ? 'brand' : 'neutral'}>{r.role.toLowerCase()}</Badge>
        ),
    },
    {
      key: 'active',
      header: 'Active',
      align: 'center',
      cell: (r) => (
        <Switch
          checked={r.isActive}
          disabled={!canManage}
          label={`${r.firstName} ${r.lastName} active`}
          onChange={(isActive) => update.mutate({ row: r, body: { isActive } })}
        />
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (r: StoreStaffDto) => (
              <button
                type="button"
                aria-label={`Remove ${r.firstName} ${r.lastName}`}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Remove ${r.firstName} ${r.lastName}?`,
                      message: 'They lose access to this store immediately. Their account is kept.',
                      confirmLabel: 'Remove',
                      tone: 'danger',
                    })
                  )
                    remove.mutate(r);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full sm:w-72"
          value={params.search}
          onChange={(v) => setParams({ search: v })}
          placeholder="Search name or email…"
          label="Search staff"
        />
        {scope === 'admin' && !storeId && (
          <StoreSelect
            hideLabel
            label="Store"
            emptyLabel="All stores"
            value={params.storeId}
            onChange={(e) => setParams({ storeId: e.target.value })}
            wrapperClassName="w-full sm:w-60"
          />
        )}
        {canManage && (
          <Button
            className="sm:ml-auto"
            leftIcon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add staff member
          </Button>
        )}
      </div>
      <DataTable
        caption="Store staff"
        columns={columns}
        data={query.data}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(r) => r.id}
        onPageChange={(page) => setParams({ page })}
        emptyTitle="No staff found"
        emptyDescription="Add people who help run the store."
      />
      <AddStaffModal
        scope={scope}
        storeId={effectiveStore}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}
