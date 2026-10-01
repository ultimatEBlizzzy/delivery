import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut, PORTAL_LOGIN } from '@/features/auth/session';
import { useAuthStore } from '@/store/auth.store';
import { Avatar } from '@/components/ui/Avatar';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { toast } from '@/store/toast.store';

export function UserMenu({
  profilePath,
  portal,
  extraItems = [],
  compact,
}: {
  profilePath: string;
  portal: 'CUSTOMER' | 'DRIVER' | 'STORE' | 'ADMIN';
  extraItems?: MenuItem[];
  compact?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  if (!user) return null;
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <Menu
      label="Account menu"
      header={
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      }
      trigger={
        <span className="flex items-center gap-2 rounded-full p-0.5 hover:bg-slate-100">
          <Avatar name={fullName} src={user.avatarUrl} size="sm" />
          {!compact && (
            <span className="hidden max-w-32 truncate pr-2 text-sm font-medium text-slate-700 lg:inline">
              {user.firstName}
            </span>
          )}
        </span>
      }
      items={[
        {
          label: 'My profile',
          icon: <UserRound className="size-4" aria-hidden />,
          onSelect: () => navigate(profilePath),
        },
        ...extraItems,
        {
          label: 'Sign out',
          tone: 'danger',
          icon: <LogOut className="size-4" aria-hidden />,
          onSelect: async () => {
            await signOut();
            toast.info('You have been signed out');
            navigate(PORTAL_LOGIN[portal], { replace: true });
          },
        },
      ]}
    />
  );
}
