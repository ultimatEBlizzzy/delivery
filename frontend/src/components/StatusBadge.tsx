import {
  DELIVERY_STATUS_LABELS,
  DeliveryStatus,
  ORDER_STATUS_LABELS,
  OrderStatus,
  PaymentStatus,
} from '@hardware-delivery/shared';
import { humanize } from '@/lib/format';
import { Badge, type Tone } from './ui/Badge';

const orderTone: Record<OrderStatus, Tone> = {
  [OrderStatus.PENDING_PAYMENT]: 'warning',
  [OrderStatus.PAID]: 'info',
  [OrderStatus.STORE_ACCEPTED]: 'info',
  [OrderStatus.PREPARING]: 'purple',
  [OrderStatus.READY_FOR_COLLECTION]: 'purple',
  [OrderStatus.DRIVER_REQUESTED]: 'warning',
  [OrderStatus.DRIVER_ASSIGNED]: 'brand',
  [OrderStatus.DRIVER_ARRIVING]: 'brand',
  [OrderStatus.COLLECTED]: 'brand',
  [OrderStatus.IN_TRANSIT]: 'brand',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
  [OrderStatus.REFUNDED]: 'neutral',
};

const deliveryTone: Record<DeliveryStatus, Tone> = {
  [DeliveryStatus.SEARCHING_DRIVER]: 'warning',
  [DeliveryStatus.DRIVER_ASSIGNED]: 'info',
  [DeliveryStatus.DRIVER_ARRIVING]: 'brand',
  [DeliveryStatus.AT_PICKUP]: 'brand',
  [DeliveryStatus.COLLECTED]: 'brand',
  [DeliveryStatus.IN_TRANSIT]: 'brand',
  [DeliveryStatus.DELIVERED]: 'success',
  [DeliveryStatus.CANCELLED]: 'danger',
};

const paymentTone: Record<PaymentStatus, Tone> = {
  [PaymentStatus.PENDING]: 'warning',
  [PaymentStatus.PAID]: 'success',
  [PaymentStatus.FAILED]: 'danger',
  [PaymentStatus.CANCELLED]: 'neutral',
  [PaymentStatus.PARTIALLY_REFUNDED]: 'info',
  [PaymentStatus.REFUNDED]: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={orderTone[status] ?? 'neutral'}>
      {ORDER_STATUS_LABELS[status] ?? humanize(status)}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <Badge tone={deliveryTone[status] ?? 'neutral'}>
      {DELIVERY_STATUS_LABELS[status] ?? humanize(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTone[status] ?? 'neutral'}>{humanize(status)}</Badge>;
}

/** Generic approval/verification badge (stores, drivers, documents, vehicles). */
export function ApprovalBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'APPROVED' || status === 'ACTIVE' || status === 'VISIBLE'
      ? 'success'
      : status === 'PENDING' || status === 'IN_REVIEW' || status === 'OPEN'
        ? 'warning'
        : status === 'REJECTED' || status === 'SUSPENDED' || status === 'HIDDEN'
          ? 'danger'
          : 'neutral';
  return <Badge tone={tone}>{humanize(status)}</Badge>;
}
