import { PageHeader } from '@/components/ui/PageHeader';
import { StaffPanel } from '@/features/stores/StaffPanel';

export default function AdminStoreStaffPage() {
  return (
    <div>
      <PageHeader
        title="Store staff"
        description="Everyone who can sign in to a store portal, with their role. Owners manage everything, managers run products and orders, staff handle orders and stock."
      />
      <StaffPanel scope="admin" />
    </div>
  );
}
