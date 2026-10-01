import { PageHeader } from '@/components/ui/PageHeader';
import { StoreSelect } from '@/features/stores/StoreSelect';
import { ListingsPanel } from '@/features/catalogue/ListingsPanel';
import { useQueryParams } from '@/hooks/useQueryParams';

export default function AdminInventoryPage() {
  const [params, setParams] = useQueryParams({ storeId: '' });
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock levels across all stores. Every change is recorded in the stock history with who made it and why."
      />
      <div className="mb-4 max-w-xs">
        <StoreSelect
          label="Store"
          emptyLabel="All stores"
          value={params.storeId}
          onChange={(e) => setParams({ storeId: e.target.value })}
        />
      </div>
      <ListingsPanel scope="admin" mode="inventory" />
    </div>
  );
}
