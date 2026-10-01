import { STOCK_STATUS_LABELS, type StockStatus } from '@hardware-delivery/shared';
import { Badge, type Tone } from '@/components/ui/Badge';

const tones: Record<StockStatus, Tone> = {
  OUT_OF_STOCK: 'danger',
  LOW_STOCK: 'warning',
  IN_STOCK: 'success',
};

export function StockBadge({ status, quantity }: { status: StockStatus; quantity?: number }) {
  return (
    <Badge tone={tones[status]}>
      {quantity !== undefined && status !== 'OUT_OF_STOCK' ? `${quantity} · ` : ''}
      {STOCK_STATUS_LABELS[status]}
    </Badge>
  );
}
