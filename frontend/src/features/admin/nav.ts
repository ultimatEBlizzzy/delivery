import {
  Boxes,
  FolderTree,
  Package,
  ScrollText,
  Settings,
  Store,
  UserRound,
  Users,
} from 'lucide-react';
import type { NavEntry } from '@/components/layout/PortalLayout';

/** Admin sidebar. Items are added here as each admin module is delivered. */
export const adminNav: NavEntry[] = [
  { section: 'Marketplace' },
  { to: '/admin/stores', label: 'Stores', icon: Store },
  { to: '/admin/store-staff', label: 'Store staff', icon: Users },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { section: 'Platform' },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { section: 'Account' },
  { to: '/admin/profile', label: 'My profile', icon: UserRound },
];
