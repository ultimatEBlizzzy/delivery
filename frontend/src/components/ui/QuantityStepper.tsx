import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

/** − / + control with a typeable value, clamped to [min, max]. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  label = 'Quantity',
  size = 'md',
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const clamp = (n: number) =>
    Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, Math.floor(n) || min));
  const btn = cn(
    'flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40',
    size === 'sm' ? 'size-8' : 'size-10',
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white',
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className={cn(
          'border-x border-slate-200 text-center text-sm font-semibold [appearance:textfield] focus:outline-none',
          size === 'sm' ? 'h-8 w-12' : 'h-10 w-14',
        )}
      />
      <button
        type="button"
        className={btn}
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
