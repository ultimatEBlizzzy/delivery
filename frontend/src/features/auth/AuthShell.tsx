import { ShieldCheck, Truck, Warehouse, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { env } from '@/env';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const PITCHES: Record<string, { headline: string; points: Array<[typeof Truck, string]> }> = {
  customer: {
    headline: 'Hardware, delivered to your site.',
    points: [
      [Warehouse, 'Compare prices from local hardware stores'],
      [Truck, 'Bakkie, van or truck – matched to your load'],
      [ShieldCheck, 'Secure payment and live delivery tracking'],
    ],
  },
  driver: {
    headline: 'Drive. Deliver. Get paid.',
    points: [
      [Truck, 'Accept delivery requests that suit your vehicle'],
      [Wrench, 'Clear earnings for every job you complete'],
      [ShieldCheck, 'Turn-by-turn navigation links built in'],
    ],
  },
  store: {
    headline: 'Sell more, without the delivery headache.',
    points: [
      [Warehouse, 'Manage your prices, stock and orders in one place'],
      [Truck, 'We find the right driver when the order is ready'],
      [ShieldCheck, 'Payments confirmed before you pick a single item'],
    ],
  },
  admin: {
    headline: 'Run the marketplace.',
    points: [
      [Warehouse, 'Stores, products, prices and inventory'],
      [Truck, 'Dispatch, drivers and live deliveries'],
      [ShieldCheck, 'Payments, refunds, reports and audit trail'],
    ],
  },
};

/** Two-panel layout for sign-in / registration pages (brand pitch + form). */
export function AuthShell({
  portal,
  title,
  subtitle,
  children,
  footer,
}: {
  portal: 'customer' | 'driver' | 'store' | 'admin';
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useDocumentTitle(title);
  const pitch = PITCHES[portal];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-500/20 blur-3xl"
        />
        <Brand light suffix={portal === 'customer' ? undefined : portal} />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">{pitch.headline}</h2>
          <ul className="mt-8 space-y-4">
            {pitch.points.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-slate-200">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-5 text-brand-400" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">
          © {new Date().getFullYear()} {env.appName}. Made for South African builders.
        </p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand suffix={portal === 'customer' ? undefined : portal} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && (
            <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
