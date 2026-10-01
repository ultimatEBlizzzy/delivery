import { Alert } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListingsPanel } from '@/features/catalogue/ListingsPanel';
import { useMyStore } from './useMyStore';

export default function StoreProductsPage() {
  const { canEdit } = useMyStore();
  return (
    <div>
      <PageHeader
        title="Products"
        description="What you sell, at your own prices. Product details are shared with other stores; price, stock and limits are yours alone."
      />
      {!canEdit && (
        <Alert tone="info" className="mb-4">
          Your role can adjust stock but not prices or products. Ask a manager or owner to make
          those changes.
        </Alert>
      )}
      <ListingsPanel scope="store" canEdit={canEdit} />
    </div>
  );
}
