import { useQuery } from '@tanstack/react-query';
import { StoreStaffRole } from '@hardware-delivery/shared';
import { storeApi } from '@/api/stores';

/** The store the signed-in staff member works for, plus what their role allows. */
export function useMyStore() {
  const query = useQuery({ queryKey: ['store', 'me'], queryFn: storeApi.me, staleTime: 30_000 });
  const role = query.data?.myRole;
  return {
    ...query,
    store: query.data,
    role,
    /** Owners and managers may change prices, products, hours and settings. */
    canEdit: role === StoreStaffRole.OWNER || role === StoreStaffRole.MANAGER,
    isOwner: role === StoreStaffRole.OWNER,
  };
}
