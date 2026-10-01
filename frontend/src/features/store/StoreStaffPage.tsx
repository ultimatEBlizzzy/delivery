import { PageHeader } from '@/components/ui/PageHeader';
import { StaffPanel } from '@/features/stores/StaffPanel';
import { useMyStore } from './useMyStore';

export default function StoreStaffPage() {
  const { isOwner } = useMyStore();
  return (
    <div>
      <PageHeader
        title="Staff"
        description="People who can sign in to this store. Owners manage everything, managers run products and orders, staff handle orders and stock."
      />
      <StaffPanel scope="store" canManage={isOwner} />
    </div>
  );
}
