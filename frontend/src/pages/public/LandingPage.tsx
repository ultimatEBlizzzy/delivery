import {
  ArrowRight,
  Boxes,
  CreditCard,
  MapPinned,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
  Warehouse,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPE_ORDER,
  DEFAULT_VEHICLE_PROFILES,
} from '@hardware-delivery/shared';
import { buttonClasses } from '@/components/ui/Button';
import { env } from '@/env';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatWeight } from '@/lib/format';

const steps = [
  {
    icon: Store,
    title: 'Pick a store',
    text: 'Compare prices and stock from hardware stores near your site.',
  },
  {
    icon: CreditCard,
    title: 'Pay securely',
    text: 'Check out once – delivery is calculated for your exact load and distance.',
  },
  {
    icon: Warehouse,
    title: 'We prepare it',
    text: 'The store accepts, picks and packs your order.',
  },
  {
    icon: Truck,
    title: 'Driver delivers',
    text: 'A driver with the right vehicle collects it. Track them live.',
  },
];

const vehicleBlurb: Record<string, string> = {
  MOTORCYCLE: 'Small parts, fasteners, tools',
  CAR: 'A few paint tins, pipes, boxes',
  BAKKIE: 'Cement, sand, timber, tiles',
  PANEL_VAN: 'Bulky or fragile loads, ladders',
  TRUCK: 'Pallets, bricks and bulk building loads',
};

export default function LandingPage() {
  useDocumentTitle();
  return (
    <div>
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-[28rem] rounded-full bg-brand-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/3 size-[26rem] rounded-full bg-brand-500/15 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-brand-200">
              <ShieldCheck className="size-4" aria-hidden /> Local stores. Right vehicle. On site.
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Hardware delivered to your site – <span className="text-brand-400">fast</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Order cement, pipes, paint and tools from hardware stores near you. {env.appName}{' '}
              sends a bakkie, van or truck that can actually carry your load.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/stores" className={buttonClasses({ size: 'lg' })}>
                Browse stores <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link
                to="/register"
                className={buttonClasses({
                  size: 'lg',
                  variant: 'outline',
                  className: 'border-white/30 bg-transparent text-white hover:bg-white/10',
                })}
              >
                Create account
              </Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              [MapPinned, 'Live tracking', 'Watch your driver on the map'],
              [Boxes, 'Capacity-aware', '30 bags of cement never go on a motorcycle'],
              [PackageCheck, 'Proof of delivery', 'Photo and signature on drop-off'],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof MapPinned;
              return (
                <li
                  key={title as string}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/90">
                    <I className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">{title as string}</span>
                    <span className="block text-sm text-slate-300">{text as string}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <span
                className="absolute right-5 top-4 text-5xl font-black text-slate-100"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <s.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            The right vehicle for every load
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            We work out the weight and size of your order and only offer drivers whose vehicle can
            safely carry it.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {VEHICLE_TYPE_ORDER.map((v) => (
              <li key={v} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <Truck className="size-7 text-brand-600" aria-hidden />
                <h3 className="mt-3 font-semibold">{VEHICLE_TYPE_LABELS[v]}</h3>
                <p className="text-sm text-slate-600">{vehicleBlurb[v]}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Up to {formatWeight(DEFAULT_VEHICLE_PROFILES[v].maxWeightKg)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-2">
        <div className="rounded-2xl bg-brand-600 p-8 text-white">
          <h2 className="text-2xl font-bold">Own a hardware store?</h2>
          <p className="mt-2 text-brand-50">
            List your products, manage stock and let us handle delivery to your customers.
          </p>
          <Link to="/store/login" className={buttonClasses({ variant: 'dark', className: 'mt-6' })}>
            Open the store portal
          </Link>
        </div>
        <div className="rounded-2xl bg-slate-900 p-8 text-white">
          <h2 className="text-2xl font-bold">Got a bakkie, van or truck?</h2>
          <p className="mt-2 text-slate-300">
            Register as a driver, accept delivery requests near you and earn on every job.
          </p>
          <Link to="/driver/register" className={buttonClasses({ className: 'mt-6' })}>
            Become a driver
          </Link>
        </div>
      </section>
    </div>
  );
}
