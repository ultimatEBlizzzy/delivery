import { ScrollText, Settings, UserRound } from 'lucide-react';
import type { NavEntry } from '@/components/layout/PortalLayout';

/** Admin sidebar. Items are added here as each admin module is delivered. */
export const adminNav: NavEntry[] = [
  { section: 'Platform' },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { section: 'Account' },
  { to: '/admin/profile', label: 'My profile', icon: UserRound },
];
