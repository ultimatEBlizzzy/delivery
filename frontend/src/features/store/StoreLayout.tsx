import { Boxes, LayoutDashboard, Package, Settings, UserRound, Users } from 'lucide-react';
import { Role } from '@hardware-delivery/shared';
import { PortalLayout, type NavEntry } from '@/components/layout/PortalLayout';
import { Alert } from '@/components/ui/Feedback';
import { useMyStore } from './useMyStore';

/** Store portal shell. Shows a banner while the store cannot trade (pending, rejected or suspended). */
export function StoreLayout() {
  const { store, isOwner, canEdit } = useMyStore();
  const nav: NavEntry[] = [
    { section: store?.name ?? 'My store' },
    { to: '/store', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/store/products', label: 'Products', icon: Package },
    { to: '/store/inventory', label: 'Inventory', icon: Boxes },
    ...(canEdit || isOwner ? [{ to: '/store/staff', label: 'Staff', icon: Users }] : []),
    { to: '/store/settings', label: 'Store settings', icon: Settings },
    { section: 'Account' },
    { to: '/store/profile', label: 'My profile', icon: UserRound },
  ];
  return (
    <PortalLayout
      portal={Role.STORE}
      label="Store"
      nav={nav}
      profilePath="/store/profile"
      banner={
        store && store.status !== 'APPROVED' ? (
          <Alert
            tone={store.status === 'PENDING' ? 'warning' : 'danger'}
            title={store.status === 'PENDING' ? 'Awaiting approval' : 'Your store was not approved'}
          >
            {store.status === 'PENDING'
              ? 'You can set up products and stock now. Customers will not see your store until an administrator approves it.'
              : store.rejectionReason || 'Please contact support.'}
          </Alert>
        ) : store && !store.isActive ? (
          <Alert tone="danger" title="Your store is suspended">
            Customers cannot see or order from your store. Please contact support.
          </Alert>
        ) : undefined
      }
    />
  );
}
