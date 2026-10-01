import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  getSettingDefinition,
  validateSettingValue,
  type PeakWindow,
  type SettingDto,
  type SettingGroup,
} from '@hardware-delivery/shared';
import { settingsApi } from '@/api/settings';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Switch } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import { toast } from '@/store/toast.store';

export const SETTINGS_KEY = ['admin', 'settings'] as const;

const GROUPS: Array<{ id: SettingGroup; label: string; description: string }> = [
  { id: 'general', label: 'General', description: 'Platform name and support contact details.' },
  {
    id: 'fees',
    label: 'Service fee',
    description: 'The fee customers pay on top of the products subtotal.',
  },
  {
    id: 'commission',
    label: 'Commissions',
    description: 'How revenue is split between the platform, stores and drivers.',
  },
  { id: 'orders', label: 'Orders', description: 'Order lifecycle rules.' },
  {
    id: 'dispatch',
    label: 'Dispatch',
    description: 'How drivers are found and offered deliveries.',
  },
  { id: 'delivery', label: 'Delivery proof', description: 'Evidence drivers must capture.' },
  {
    id: 'pricing',
    label: 'Pricing rules',
    description: 'Peak-time windows and load-weight defaults used for delivery pricing.',
  },
];

const DAYS: Array<{ value: number; short: string; long: string }> = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

function NumberField({
  value,
  onChange,
  unit,
  label,
  invalid,
  describedBy,
}: {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  label: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : '');
  useEffect(() => {
    if (Number(text) !== value) setText(Number.isFinite(value) ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when the value changes from outside
  }, [value]);
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value === '' ? Number.NaN : Number(e.target.value));
        }}
        className={cn(
          'h-10 w-full rounded-lg border bg-white px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30 focus:outline-offset-0',
          unit && 'pr-12',
          invalid ? 'border-red-400' : 'border-slate-300',
        )}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
          {unit}
        </span>
      )}
    </div>
  );
}

function PeakWindowsEditor({
  value,
  onChange,
}: {
  value: PeakWindow[];
  onChange: (v: PeakWindow[]) => void;
}) {
  const update = (i: number, patch: Partial<PeakWindow>) =>
    onChange(value.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-slate-500">
          No peak windows – the peak surcharge is never applied.
        </p>
      )}
      {value.map((w, i) => (
        <fieldset key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Window {i + 1}</legend>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={`Days for window ${i + 1}`}
          >
            {DAYS.map((d) => {
              const on = w.days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.long}
                  onClick={() =>
                    update(i, {
                      days: on ? w.days.filter((x) => x !== d.value) : [...w.days, d.value].sort(),
                    })
                  }
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium',
                    on
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Input
              label="From"
              type="time"
              value={w.start}
              onChange={(e) => update(i, { start: e.target.value })}
              wrapperClassName="w-36"
            />
            <Input
              label="To"
              type="time"
              value={w.end}
              onChange={(e) => update(i, { end: e.target.value })}
              wrapperClassName="w-36"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              leftIcon={<Trash2 className="size-4" aria-hidden />}
            >
              Remove
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Plus className="size-4" aria-hidden />}
        onClick={() =>
          onChange([...value, { days: [1, 2, 3, 4, 5], start: '07:00', end: '09:00' }])
        }
      >
        Add peak window
      </Button>
    </div>
  );
}

function SettingRow({
  setting,
  value,
  error,
  onChange,
}: {
  setting: SettingDto;
  value: unknown;
  error?: string | null;
  onChange: (v: unknown) => void;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const isJson = setting.type === 'json';
  return (
    <div
      className={cn(
        'grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0',
        !isJson && 'md:grid-cols-[1fr_minmax(0,20rem)] md:items-start md:gap-8',
      )}
    >
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">
          {setting.label}
        </label>
        <p className="mt-0.5 text-sm text-slate-500">{setting.description}</p>
        {setting.updatedAt === null && (
          <p className="mt-1 text-xs text-slate-400">Using the default value</p>
        )}
      </div>
      <div>
        {setting.type === 'number' && (
          <NumberField
            value={value as number}
            onChange={onChange}
            unit={setting.unit}
            label={setting.label}
            invalid={!!error}
            describedBy={error ? errId : undefined}
          />
        )}
        {setting.type === 'boolean' && (
          <Switch checked={!!value} onChange={onChange} label={setting.label} />
        )}
        {setting.type === 'string' && (
          <Input
            id={id}
            hideLabel
            label={setting.label}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            error={undefined}
            aria-describedby={error ? errId : undefined}
          />
        )}
        {setting.key === 'pricing.peakWindows' && (
          <PeakWindowsEditor value={(value as PeakWindow[]) ?? []} onChange={onChange} />
        )}
        {error && (
          <p id={errId} role="alert" className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.getAdmin });
  const [tab, setTab] = useState<SettingGroup>('general');
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const settings = useMemo(() => query.data ?? [], [query.data]);
  const valueOf = (s: SettingDto) => (s.key in draft ? draft[s.key] : s.value);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of settings) {
      if (!(s.key in draft)) continue;
      const def = getSettingDefinition(s.key);
      const problem = def ? validateSettingValue(def, draft[s.key]) : null;
      if (problem) out[s.key] = problem;
    }
    const get = (key: string) => {
      const s = settings.find((x) => x.key === key);
      return Number(s && key in draft ? draft[key] : s?.value);
    };
    if (get('fees.serviceFeeMin') > get('fees.serviceFeeMax')) {
      out['fees.serviceFeeMax'] = 'The maximum fee must be at least the minimum fee';
    }
    return out;
  }, [settings, draft]);

  const save = useMutation({
    mutationFn: () => settingsApi.update(draft),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
      setDraft({});
      toast.success('Settings saved');
    },
  });

  const setValue = (s: SettingDto, v: unknown) =>
    setDraft((d) => {
      const next = { ...d };
      if (JSON.stringify(v) === JSON.stringify(s.value)) delete next[s.key];
      else next[s.key] = v;
      return next;
    });

  const changed = Object.keys(draft).length;
  const hasErrors = Object.keys(errors).length > 0;
  const group = GROUPS.find((g) => g.id === tab)!;
  const countFor = (id: SettingGroup) =>
    settings.filter((s) => s.group === id && s.key in draft).length;

  return (
    <div className="pb-24">
      <PageHeader
        title="Platform settings"
        description="Fees, commissions and rules that apply across the marketplace. Changes take effect immediately for new orders."
      />

      {query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : (
        <>
          <Tabs
            label="Settings sections"
            value={tab}
            onChange={setTab}
            tabs={GROUPS.map((g) => ({
              id: g.id,
              label: g.label,
              count: countFor(g.id) || undefined,
            }))}
            className="mb-5"
          />
          <Card>
            <CardHeader title={group.label} description={group.description} />
            {query.isLoading ? (
              <CardBody className="space-y-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </CardBody>
            ) : (
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {settings
                  .filter((s) => s.group === tab)
                  .map((s) => (
                    <SettingRow
                      key={s.key}
                      setting={s}
                      value={valueOf(s)}
                      error={errors[s.key]}
                      onChange={(v) => setValue(s, v)}
                    />
                  ))}
              </div>
            )}
          </Card>
        </>
      )}

      {changed > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-pop backdrop-blur lg:pl-64">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 sm:px-4 lg:px-8">
            <p className="text-sm text-slate-700" role="status">
              <strong>{changed}</strong> unsaved {changed === 1 ? 'change' : 'changes'}
              {hasErrors && (
                <span className="ml-2 text-red-600">– fix the highlighted fields to save</span>
              )}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                leftIcon={<RotateCcw className="size-4" aria-hidden />}
                onClick={() => setDraft({})}
                disabled={save.isPending}
              >
                Discard
              </Button>
              <Button
                leftIcon={<Save className="size-4" aria-hidden />}
                loading={save.isPending}
                disabled={hasErrors}
                onClick={() => save.mutate()}
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
