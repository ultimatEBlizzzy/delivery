import { ShieldAlert } from 'lucide-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '@hardware-delivery/shared';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageLoader } from '@/components/ui/Feedback';
import { useAuthStore } from '@/store/auth.store';
import { PORTAL_LOGIN, ROLE_HOME, signOut } from './session';

/** Route guard: renders the nested routes only for signed-in users that hold `role`. */
export function RequireRole({ role }: { role: Role }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();

  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status === 'anonymous' || !user) {
    return (
      <Navigate
        to={PORTAL_LOGIN[role]}
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }
  if (!user.roles.includes(role)) {
    const ownHome = ROLE_HOME[user.roles[0]] ?? '/';
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={<ShieldAlert className="size-7 text-amber-500" aria-hidden />}
          title="You don’t have access to this area"
          description={`You are signed in as ${user.email}, but this account is not set up as ${role.toLowerCase()}.`}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate(ownHome)}>Go to my account</Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate(PORTAL_LOGIN[role]);
                }}
              >
                Sign in with another account
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return <Outlet />;
}
