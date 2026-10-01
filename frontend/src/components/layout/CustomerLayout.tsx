import { Home, LayoutGrid, Package, Search, Store, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useMatches, useNavigate } from 'react-router-dom';
import { Role } from '@hardware-delivery/shared';
import { Brand } from '@/components/Brand';
import { buttonClasses } from '@/components/ui/Button';
import { env } from '@/env';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { UserMenu } from './UserMenu';

const desktopNav = [
  { to: '/stores', label: 'Stores' },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
];

const mobileTabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/stores', label: 'Stores', icon: Store },
  { to: '/products', label: 'Browse', icon: LayoutGrid },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/profile', label: 'Account', icon: UserRound },
];

function HeaderSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/products${text.trim() ? `?search=${encodeURIComponent(text.trim())}` : ''}`);
      }}
    >
      <label htmlFor="header-search" className="sr-only">
        Search hardware and building materials
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        id="header-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search cement, pipes, paint, tools…"
        className="h-11 w-full rounded-full border border-slate-200 bg-slate-100 pl-10 pr-4 text-sm placeholder:text-slate-500 focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-brand-500/30 focus:outline-offset-0"
      />
    </form>
  );
}

/** Customer app shell: sticky header, content, footer; bottom tab bar on phones. */
export function CustomerLayout({ headerActions }: { headerActions?: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const isCustomer = !!user?.roles.includes(Role.CUSTOMER);
  // Pages such as the landing page opt out of the centred content container (route `handle`).
  const fullBleed = useMatches().some(
    (m) => (m.handle as { fullBleed?: boolean } | undefined)?.fullBleed,
  );

  return (
    <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Brand />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {desktopNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <HeaderSearch className="ml-auto hidden max-w-md flex-1 md:block" />
          <div className="ml-auto flex items-center gap-1.5 md:ml-0 sm:gap-2">
            {headerActions}
            {status === 'authenticated' && user ? (
              <UserMenu portal="CUSTOMER" profilePath="/profile" />
            ) : (
              status === 'anonymous' && (
                <>
                  <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className={cn(buttonClasses({ size: 'sm' }), 'hidden sm:inline-flex')}
                  >
                    Sign up
                  </Link>
                </>
              )
            )}
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <HeaderSearch />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'flex-1 outline-none',
          !fullBleed && 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8',
        )}
      >
        <Outlet />
      </main>

      <footer className="hidden border-t border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
          <p>
            © {new Date().getFullYear()} {env.appName}. Hardware delivered across South Africa.
          </p>
          <p className="flex gap-5">
            <Link to="/driver/login" className="hover:text-slate-800">
              Deliver with us
            </Link>
            <Link to="/store/login" className="hover:text-slate-800">
              Sell your hardware
            </Link>
          </p>
        </div>
      </footer>

      {/* Phone navigation */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {mobileTabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={
                  isCustomer || t.to === '/' || t.to === '/stores' || t.to === '/products'
                    ? t.to
                    : '/login'
                }
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-1 pt-2 text-[11px] font-medium',
                    isActive ? 'text-brand-700' : 'text-slate-500',
                  )
                }
              >
                <t.icon className="size-6" aria-hidden />
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
