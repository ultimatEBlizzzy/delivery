import { Menu as MenuIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@hardware-delivery/shared';
import { Brand } from '@/components/Brand';
import { cn } from '@/lib/cn';
import { UserMenu } from './UserMenu';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number | null;
}
export type NavEntry = NavItem | { section: string };

const isItem = (e: NavEntry): e is NavItem => 'to' in e;

function NavList({ nav, onNavigate }: { nav: NavEntry[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {nav.map((entry, i) =>
          isItem(entry) ? (
            <li key={entry.to}>
              <NavLink
                to={entry.to}
                end={entry.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <entry.icon className="size-5 shrink-0 opacity-90" aria-hidden />
                <span className="flex-1 truncate">{entry.label}</span>
                {!!entry.badge && (
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-brand-700">
                    {entry.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ) : (
            <li
              key={`${entry.section}-${i}`}
              className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              {entry.section}
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

/**
 * Desktop-first dashboard shell: fixed dark sidebar, top bar with notifications + user menu.
 * On small screens the sidebar becomes a slide-in drawer built on <dialog>.
 */
export function PortalLayout({
  portal,
  label,
  nav,
  profilePath,
  topbarExtra,
  sidebarFooter,
}: {
  portal: Role;
  label: string;
  nav: NavEntry[];
  profilePath: string;
  topbarExtra?: ReactNode;
  sidebarFooter?: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (drawerOpen && !d.open) d.showModal();
    if (!drawerOpen && d.open) d.close();
  }, [drawerOpen]);

  const brandTo = nav.find(isItem)?.to ?? '/';

  return (
    <div className="min-h-dvh bg-slate-50 lg:pl-64">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Brand to={brandTo} suffix={label} light />
        </div>
        <NavList nav={nav} />
        {sidebarFooter && <div className="border-t border-white/10 p-4">{sidebarFooter}</div>}
      </aside>

      <dialog
        ref={dialogRef}
        aria-label="Navigation"
        onClose={() => setDrawerOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawerOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 bg-slate-900 p-0 backdrop:bg-slate-900/60 lg:hidden"
      >
        {drawerOpen && (
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <Brand to={brandTo} suffix={label} light />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                aria-label="Close navigation"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavList nav={nav} onNavigate={() => setDrawerOpen(false)} />
            {sidebarFooter && <div className="border-t border-white/10 p-4">{sidebarFooter}</div>}
          </div>
        )}
      </dialog>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon className="size-6" aria-hidden />
        </button>
        <div className="lg:hidden">
          <Brand to={brandTo} />
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {topbarExtra}
          <UserMenu
            portal={portal as 'ADMIN' | 'STORE' | 'DRIVER' | 'CUSTOMER'}
            profilePath={profilePath}
          />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1400px] p-4 outline-none sm:p-6 lg:p-8"
      >
        <Outlet />
      </main>
    </div>
  );
}
