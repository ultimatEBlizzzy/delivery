import { DeliveryStatus, OrderStatus, Role } from './enums';

/** Who is performing a transition. `SYSTEM` covers payments, dispatch and schedulers. */
export type Actor = Role | 'SYSTEM';

/**
 * Allowed order status transitions (graph edges).
 * Reassignment edges (DRIVER_ASSIGNED/DRIVER_ARRIVING -> DRIVER_REQUESTED) exist so that a
 * driver can release a job, or an admin can reassign it, and dispatch starts again.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.STORE_ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.STORE_ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_COLLECTION, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_COLLECTION]: [OrderStatus.DRIVER_REQUESTED, OrderStatus.CANCELLED],
  [OrderStatus.DRIVER_REQUESTED]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.DRIVER_ASSIGNED]: [
    OrderStatus.DRIVER_ARRIVING,
    OrderStatus.DRIVER_REQUESTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DRIVER_ARRIVING]: [
    OrderStatus.COLLECTED,
    OrderStatus.DRIVER_REQUESTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.COLLECTED]: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

const ANY: readonly Actor[] = [Role.ADMIN, 'SYSTEM'];

/**
 * Which actors may perform which edge. Admin can always act (support override), but only along
 * valid graph edges. Customers can only cancel while the store has not started preparing.
 */
const TRANSITION_ACTORS: Readonly<
  Partial<Record<OrderStatus, Partial<Record<OrderStatus, readonly Actor[]>>>>
> = {
  [OrderStatus.PENDING_PAYMENT]: {
    [OrderStatus.PAID]: ['SYSTEM', Role.ADMIN],
    [OrderStatus.CANCELLED]: [Role.CUSTOMER, ...ANY],
  },
  [OrderStatus.PAID]: {
    [OrderStatus.STORE_ACCEPTED]: [Role.STORE, ...ANY],
    [OrderStatus.CANCELLED]: [Role.CUSTOMER, Role.STORE, ...ANY], // store "reject"
  },
  [OrderStatus.STORE_ACCEPTED]: {
    [OrderStatus.PREPARING]: [Role.STORE, ...ANY],
    [OrderStatus.CANCELLED]: [Role.CUSTOMER, Role.STORE, ...ANY],
  },
  [OrderStatus.PREPARING]: {
    [OrderStatus.READY_FOR_COLLECTION]: [Role.STORE, ...ANY],
    [OrderStatus.CANCELLED]: [Role.STORE, ...ANY],
  },
  [OrderStatus.READY_FOR_COLLECTION]: {
    [OrderStatus.DRIVER_REQUESTED]: ANY,
    [OrderStatus.CANCELLED]: ANY,
  },
  [OrderStatus.DRIVER_REQUESTED]: {
    [OrderStatus.DRIVER_ASSIGNED]: [Role.DRIVER, ...ANY],
    [OrderStatus.CANCELLED]: ANY,
  },
  [OrderStatus.DRIVER_ASSIGNED]: {
    [OrderStatus.DRIVER_ARRIVING]: [Role.DRIVER, ...ANY],
    [OrderStatus.DRIVER_REQUESTED]: [Role.DRIVER, ...ANY],
    [OrderStatus.CANCELLED]: ANY,
  },
  [OrderStatus.DRIVER_ARRIVING]: {
    [OrderStatus.COLLECTED]: [Role.DRIVER, ...ANY],
    [OrderStatus.DRIVER_REQUESTED]: [Role.DRIVER, ...ANY],
    [OrderStatus.CANCELLED]: ANY,
  },
  [OrderStatus.COLLECTED]: {
    [OrderStatus.IN_TRANSIT]: [Role.DRIVER, ...ANY],
    [OrderStatus.CANCELLED]: ANY,
  },
  [OrderStatus.IN_TRANSIT]: {
    [OrderStatus.DELIVERED]: [Role.DRIVER, ...ANY],
    [OrderStatus.CANCELLED]: ANY,
  },
  [OrderStatus.DELIVERED]: { [OrderStatus.REFUNDED]: ANY },
  [OrderStatus.CANCELLED]: { [OrderStatus.REFUNDED]: ANY },
};

/** True when `from -> to` is a valid edge of the order state graph. */
export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** True when the edge is valid AND the actor is allowed to perform it. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  if (!isValidOrderTransition(from, to)) return false;
  return TRANSITION_ACTORS[from]?.[to]?.includes(actor) ?? false;
}

/** Next statuses an actor could move an order to from `from` (drives which buttons the UI shows). */
export function allowedNextOrderStatuses(from: OrderStatus, actor: Actor): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((to) => canTransitionOrder(from, to, actor));
}

/** Statuses from which the customer may still cancel (store has not started preparing). */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.STORE_ACCEPTED,
];

/** Orders that are finished (no more fulfilment work). DELIVERED may still be refunded. */
export const ORDER_CLOSED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

/** Orders that are in the fulfilment pipeline (paid, not closed). */
export const ORDER_IN_PROGRESS_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.STORE_ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_COLLECTION,
  OrderStatus.DRIVER_REQUESTED,
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.DRIVER_ARRIVING,
  OrderStatus.COLLECTED,
  OrderStatus.IN_TRANSIT,
];

/** Order statuses in which an order consumes stock (everything except cancelled/refunded). */
export const ORDER_STOCK_HELD_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  ...ORDER_IN_PROGRESS_STATUSES,
  OrderStatus.DELIVERED,
];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING_PAYMENT]: 'Awaiting payment',
  [OrderStatus.PAID]: 'Paid',
  [OrderStatus.STORE_ACCEPTED]: 'Store accepted',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.READY_FOR_COLLECTION]: 'Ready for collection',
  [OrderStatus.DRIVER_REQUESTED]: 'Finding a driver',
  [OrderStatus.DRIVER_ASSIGNED]: 'Driver assigned',
  [OrderStatus.DRIVER_ARRIVING]: 'Driver collecting',
  [OrderStatus.COLLECTED]: 'Collected',
  [OrderStatus.IN_TRANSIT]: 'On the way',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.REFUNDED]: 'Refunded',
};

// ---------------------------------------------------------------------------------------------
// Delivery state machine
// ---------------------------------------------------------------------------------------------

export const DELIVERY_TRANSITIONS: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
  [DeliveryStatus.SEARCHING_DRIVER]: [DeliveryStatus.DRIVER_ASSIGNED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.DRIVER_ASSIGNED]: [
    DeliveryStatus.DRIVER_ARRIVING,
    DeliveryStatus.SEARCHING_DRIVER,
    DeliveryStatus.CANCELLED,
  ],
  [DeliveryStatus.DRIVER_ARRIVING]: [
    DeliveryStatus.AT_PICKUP,
    DeliveryStatus.SEARCHING_DRIVER,
    DeliveryStatus.CANCELLED,
  ],
  [DeliveryStatus.AT_PICKUP]: [
    DeliveryStatus.COLLECTED,
    DeliveryStatus.SEARCHING_DRIVER,
    DeliveryStatus.CANCELLED,
  ],
  [DeliveryStatus.COLLECTED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.CANCELLED],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.CANCELLED]: [],
};

export function isValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The order status that mirrors each delivery status. AT_PICKUP has no dedicated order status
 * (the order remains DRIVER_ARRIVING until the driver confirms collection).
 */
export const DELIVERY_TO_ORDER_STATUS: Readonly<Record<DeliveryStatus, OrderStatus | null>> = {
  [DeliveryStatus.SEARCHING_DRIVER]: OrderStatus.DRIVER_REQUESTED,
  [DeliveryStatus.DRIVER_ASSIGNED]: OrderStatus.DRIVER_ASSIGNED,
  [DeliveryStatus.DRIVER_ARRIVING]: OrderStatus.DRIVER_ARRIVING,
  [DeliveryStatus.AT_PICKUP]: null,
  [DeliveryStatus.COLLECTED]: OrderStatus.COLLECTED,
  [DeliveryStatus.IN_TRANSIT]: OrderStatus.IN_TRANSIT,
  [DeliveryStatus.DELIVERED]: OrderStatus.DELIVERED,
  [DeliveryStatus.CANCELLED]: OrderStatus.CANCELLED,
};

/** Delivery statuses where a driver is committed to the job. */
export const DELIVERY_ACTIVE_DRIVER_STATUSES: readonly DeliveryStatus[] = [
  DeliveryStatus.DRIVER_ASSIGNED,
  DeliveryStatus.DRIVER_ARRIVING,
  DeliveryStatus.AT_PICKUP,
  DeliveryStatus.COLLECTED,
  DeliveryStatus.IN_TRANSIT,
];

export const DELIVERY_STATUS_LABELS: Readonly<Record<DeliveryStatus, string>> = {
  [DeliveryStatus.SEARCHING_DRIVER]: 'Searching for a driver',
  [DeliveryStatus.DRIVER_ASSIGNED]: 'Driver assigned',
  [DeliveryStatus.DRIVER_ARRIVING]: 'Heading to the store',
  [DeliveryStatus.AT_PICKUP]: 'At the store',
  [DeliveryStatus.COLLECTED]: 'Order collected',
  [DeliveryStatus.IN_TRANSIT]: 'On the way to customer',
  [DeliveryStatus.DELIVERED]: 'Delivered',
  [DeliveryStatus.CANCELLED]: 'Cancelled',
};

// ---------------------------------------------------------------------------------------------
// Customer-facing tracking timeline
// ---------------------------------------------------------------------------------------------

export type TrackingStepState = 'done' | 'current' | 'upcoming';

export interface TrackingStep {
  key: string;
  label: string;
  state: TrackingStepState;
  /** Extra context for the *current* step, e.g. "Finding a driver…". */
  hint?: string;
}

const TRACKING_LABELS = [
  'Order placed',
  'Payment confirmed',
  'Store accepted',
  'Preparing',
  'Driver assigned',
  'Driver collecting',
  'In transit',
  'Delivered',
] as const;

/** Index of the step that is "current" for a status (8 = everything complete). */
const TRACKING_RANK: Readonly<Record<OrderStatus, number>> = {
  [OrderStatus.PENDING_PAYMENT]: 1,
  [OrderStatus.PAID]: 2,
  [OrderStatus.STORE_ACCEPTED]: 3,
  [OrderStatus.PREPARING]: 3,
  [OrderStatus.READY_FOR_COLLECTION]: 4,
  [OrderStatus.DRIVER_REQUESTED]: 4,
  [OrderStatus.DRIVER_ASSIGNED]: 5,
  [OrderStatus.DRIVER_ARRIVING]: 5,
  [OrderStatus.COLLECTED]: 6,
  [OrderStatus.IN_TRANSIT]: 6,
  [OrderStatus.DELIVERED]: 8,
  [OrderStatus.CANCELLED]: -1,
  [OrderStatus.REFUNDED]: -1,
};

const TRACKING_HINTS: Readonly<Partial<Record<OrderStatus, string>>> = {
  [OrderStatus.PENDING_PAYMENT]: 'Waiting for your payment',
  [OrderStatus.PAID]: 'Waiting for the store to accept your order',
  [OrderStatus.STORE_ACCEPTED]: 'The store is about to start preparing your order',
  [OrderStatus.PREPARING]: 'The store is preparing your order',
  [OrderStatus.READY_FOR_COLLECTION]: 'Your order is ready – finding a driver',
  [OrderStatus.DRIVER_REQUESTED]: 'Finding a driver near the store',
  [OrderStatus.DRIVER_ASSIGNED]: 'Your driver is on the way to the store',
  [OrderStatus.DRIVER_ARRIVING]: 'Your driver is collecting your order',
  [OrderStatus.COLLECTED]: 'Your driver has your order and is about to leave',
  [OrderStatus.IN_TRANSIT]: 'Your order is on its way to you',
};

/**
 * Build the 8-step tracking timeline shown to customers. For cancelled/refunded orders every step
 * after the point of cancellation is "upcoming" and the caller should render a banner instead.
 */
export function buildTrackingSteps(
  status: OrderStatus,
  options: { reachedRank?: number } = {},
): TrackingStep[] {
  let rank = TRACKING_RANK[status];
  if (rank < 0) rank = options.reachedRank ?? 1;
  const closed = status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED;
  return TRACKING_LABELS.map((label, i) => {
    const state: TrackingStepState =
      i < rank ? 'done' : i === rank && !closed ? 'current' : 'upcoming';
    const step: TrackingStep = { key: label.toLowerCase().replace(/\s+/g, '_'), label, state };
    if (state === 'current' && TRACKING_HINTS[status]) step.hint = TRACKING_HINTS[status];
    return step;
  });
}

/** The tracking rank reached by a status (used to freeze the timeline for cancelled orders). */
export function trackingRankOf(status: OrderStatus): number {
  return TRACKING_RANK[status];
}
