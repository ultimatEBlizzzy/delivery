import { WEEKDAYS, type OperatingHours, type Weekday } from '@hardware-delivery/shared';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Weekly opening hours: a closed switch and open/close times per day. */
export function HoursEditor({
  value,
  onChange,
}: {
  value: OperatingHours;
  onChange: (v: OperatingHours) => void;
}) {
  const set = (day: Weekday, patch: Partial<OperatingHours[Weekday]>) =>
    onChange({ ...value, [day]: { ...value[day], ...patch } });
  const copyWeekdays = () => {
    const mon = value.mon;
    onChange({ ...value, tue: { ...mon }, wed: { ...mon }, thu: { ...mon }, fri: { ...mon } });
  };
  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {WEEKDAYS.map((day) => {
          const d = value[day];
          const invalid = !d.closed && d.open >= d.close;
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="w-24 text-sm font-medium text-slate-800">{DAY_NAMES[day]}</span>
              <Switch
                checked={!d.closed}
                onChange={(open) => set(day, { closed: !open })}
                label={`${DAY_NAMES[day]} open`}
              />
              <span
                className={cn('w-14 text-sm', d.closed ? 'text-slate-400' : 'text-emerald-700')}
              >
                {d.closed ? 'Closed' : 'Open'}
              </span>
              <div
                className={cn(
                  'flex items-center gap-2',
                  d.closed && 'pointer-events-none opacity-40',
                )}
              >
                <input
                  type="time"
                  aria-label={`${DAY_NAMES[day]} opens at`}
                  value={d.open}
                  disabled={d.closed}
                  onChange={(e) => set(day, { open: e.target.value })}
                  className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                />
                <span className="text-slate-400" aria-hidden>
                  to
                </span>
                <input
                  type="time"
                  aria-label={`${DAY_NAMES[day]} closes at`}
                  value={d.close}
                  disabled={d.closed}
                  onChange={(e) => set(day, { close: e.target.value })}
                  className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                />
              </div>
              {invalid && (
                <span role="alert" className="text-sm text-red-600">
                  Closing time must be after opening time
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" size="sm" className="mt-2" onClick={copyWeekdays}>
        Copy Monday’s hours to Tuesday–Friday
      </Button>
    </div>
  );
}
