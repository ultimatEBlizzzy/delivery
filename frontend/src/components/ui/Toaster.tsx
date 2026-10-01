import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/store/toast.store';

const styles = {
  success: {
    box: 'border-emerald-200 bg-white',
    icon: <CircleCheck className="size-5 text-emerald-600" aria-hidden />,
  },
  error: {
    box: 'border-red-200 bg-white',
    icon: <CircleAlert className="size-5 text-red-600" aria-hidden />,
  },
  info: {
    box: 'border-sky-200 bg-white',
    icon: <Info className="size-5 text-sky-600" aria-hidden />,
  },
};

/** Live region: screen readers announce toasts without stealing focus. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border px-4 py-3 shadow-pop',
            styles[t.tone].box,
          )}
        >
          <span className="mt-0.5 shrink-0">{styles[t.tone].icon}</span>
          <p className="flex-1 text-sm text-slate-800">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="-mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
