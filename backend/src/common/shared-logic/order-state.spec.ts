import {
  allowedNextOrderStatuses,
  buildTrackingSteps,
  canTransitionOrder,
  CUSTOMER_CANCELLABLE_STATUSES,
  DELIVERY_TO_ORDER_STATUS,
  DELIVERY_TRANSITIONS,
  DeliveryStatus,
  isValidDeliveryTransition,
  isValidOrderTransition,
  ORDER_TRANSITIONS,
  OrderStatus,
  Role,
} from '@hardware-delivery/shared';

const S = OrderStatus;

describe('order state machine', () => {
  const HAPPY_PATH = [
    S.PENDING_PAYMENT,
    S.PAID,
    S.STORE_ACCEPTED,
    S.PREPARING,
    S.READY_FOR_COLLECTION,
    S.DRIVER_REQUESTED,
    S.DRIVER_ASSIGNED,
    S.DRIVER_ARRIVING,
    S.COLLECTED,
    S.IN_TRANSIT,
    S.DELIVERED,
  ];

  it('covers every status', () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it('allows the full happy path in order', () => {
    for (let i = 0; i < HAPPY_PATH.length - 1; i++) {
      expect(isValidOrderTransition(HAPPY_PATH[i], HAPPY_PATH[i + 1])).toBe(true);
    }
  });

  it('forbids skipping steps and going backwards', () => {
    expect(isValidOrderTransition(S.PAID, S.PREPARING)).toBe(false);
    expect(isValidOrderTransition(S.PENDING_PAYMENT, S.DELIVERED)).toBe(false);
    expect(isValidOrderTransition(S.DELIVERED, S.IN_TRANSIT)).toBe(false);
    expect(isValidOrderTransition(S.PREPARING, S.PAID)).toBe(false);
  });

  it('REFUNDED is terminal and CANCELLED/DELIVERED can only move to REFUNDED', () => {
    expect(ORDER_TRANSITIONS[S.REFUNDED]).toEqual([]);
    expect(ORDER_TRANSITIONS[S.CANCELLED]).toEqual([S.REFUNDED]);
    expect(ORDER_TRANSITIONS[S.DELIVERED]).toEqual([S.REFUNDED]);
  });

  it('every edge has at least one permitted actor (no dead edges)', () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS) as [
      OrderStatus,
      OrderStatus[],
    ][]) {
      for (const to of targets) {
        const actors = [Role.CUSTOMER, Role.STORE, Role.DRIVER, Role.ADMIN, 'SYSTEM' as const];
        expect(actors.some((a) => canTransitionOrder(from, to, a))).toBe(true);
      }
    }
  });

  describe('who may do what', () => {
    it('customers may cancel only before preparation starts', () => {
      for (const status of CUSTOMER_CANCELLABLE_STATUSES) {
        expect(canTransitionOrder(status, S.CANCELLED, Role.CUSTOMER)).toBe(true);
      }
      for (const status of [
        S.PREPARING,
        S.READY_FOR_COLLECTION,
        S.DRIVER_ASSIGNED,
        S.COLLECTED,
        S.IN_TRANSIT,
        S.DELIVERED,
      ]) {
        expect(canTransitionOrder(status, S.CANCELLED, Role.CUSTOMER)).toBe(false);
      }
    });

    it('customers cannot advance an order', () => {
      expect(canTransitionOrder(S.PENDING_PAYMENT, S.PAID, Role.CUSTOMER)).toBe(false);
      expect(canTransitionOrder(S.PAID, S.STORE_ACCEPTED, Role.CUSTOMER)).toBe(false);
      expect(canTransitionOrder(S.IN_TRANSIT, S.DELIVERED, Role.CUSTOMER)).toBe(false);
    });

    it('only the system (payment confirmation) or an admin can mark an order paid', () => {
      expect(canTransitionOrder(S.PENDING_PAYMENT, S.PAID, 'SYSTEM')).toBe(true);
      expect(canTransitionOrder(S.PENDING_PAYMENT, S.PAID, Role.ADMIN)).toBe(true);
      expect(canTransitionOrder(S.PENDING_PAYMENT, S.PAID, Role.STORE)).toBe(false);
      expect(canTransitionOrder(S.PENDING_PAYMENT, S.PAID, Role.DRIVER)).toBe(false);
    });

    it('stores run the kitchen: accept, prepare, ready – and may reject', () => {
      expect(canTransitionOrder(S.PAID, S.STORE_ACCEPTED, Role.STORE)).toBe(true);
      expect(canTransitionOrder(S.STORE_ACCEPTED, S.PREPARING, Role.STORE)).toBe(true);
      expect(canTransitionOrder(S.PREPARING, S.READY_FOR_COLLECTION, Role.STORE)).toBe(true);
      expect(canTransitionOrder(S.PAID, S.CANCELLED, Role.STORE)).toBe(true);
      // …but stores cannot drive the delivery
      expect(canTransitionOrder(S.DRIVER_ARRIVING, S.COLLECTED, Role.STORE)).toBe(false);
      expect(canTransitionOrder(S.IN_TRANSIT, S.DELIVERED, Role.STORE)).toBe(false);
    });

    it('drivers drive the delivery but cannot cancel or touch the kitchen steps', () => {
      expect(canTransitionOrder(S.DRIVER_REQUESTED, S.DRIVER_ASSIGNED, Role.DRIVER)).toBe(true);
      expect(canTransitionOrder(S.DRIVER_ARRIVING, S.COLLECTED, Role.DRIVER)).toBe(true);
      expect(canTransitionOrder(S.IN_TRANSIT, S.DELIVERED, Role.DRIVER)).toBe(true);
      expect(canTransitionOrder(S.PREPARING, S.READY_FOR_COLLECTION, Role.DRIVER)).toBe(false);
      expect(canTransitionOrder(S.IN_TRANSIT, S.CANCELLED, Role.DRIVER)).toBe(false);
    });

    it('admins may act on any VALID edge but never invent edges', () => {
      expect(canTransitionOrder(S.PREPARING, S.CANCELLED, Role.ADMIN)).toBe(true);
      expect(canTransitionOrder(S.DELIVERED, S.REFUNDED, Role.ADMIN)).toBe(true);
      expect(canTransitionOrder(S.DELIVERED, S.PREPARING, Role.ADMIN)).toBe(false);
      expect(canTransitionOrder(S.PENDING_PAYMENT, S.DELIVERED, Role.ADMIN)).toBe(false);
    });

    it('lists the next actions available to an actor', () => {
      expect(allowedNextOrderStatuses(S.PAID, Role.STORE).sort()).toEqual(
        [S.CANCELLED, S.STORE_ACCEPTED].sort(),
      );
      expect(allowedNextOrderStatuses(S.PAID, Role.CUSTOMER)).toEqual([S.CANCELLED]);
      expect(allowedNextOrderStatuses(S.REFUNDED, Role.ADMIN)).toEqual([]);
    });
  });
});

describe('delivery state machine', () => {
  it('covers every delivery status', () => {
    expect(Object.keys(DELIVERY_TRANSITIONS).sort()).toEqual(Object.values(DeliveryStatus).sort());
  });

  it('follows the pickup-to-dropoff chain', () => {
    const chain = [
      DeliveryStatus.SEARCHING_DRIVER,
      DeliveryStatus.DRIVER_ASSIGNED,
      DeliveryStatus.DRIVER_ARRIVING,
      DeliveryStatus.AT_PICKUP,
      DeliveryStatus.COLLECTED,
      DeliveryStatus.IN_TRANSIT,
      DeliveryStatus.DELIVERED,
    ];
    for (let i = 0; i < chain.length - 1; i++)
      expect(isValidDeliveryTransition(chain[i], chain[i + 1])).toBe(true);
    expect(isValidDeliveryTransition(DeliveryStatus.DELIVERED, DeliveryStatus.IN_TRANSIT)).toBe(
      false,
    );
  });

  it('allows releasing a job back to the search pool only before collection', () => {
    for (const s of [
      DeliveryStatus.DRIVER_ASSIGNED,
      DeliveryStatus.DRIVER_ARRIVING,
      DeliveryStatus.AT_PICKUP,
    ]) {
      expect(isValidDeliveryTransition(s, DeliveryStatus.SEARCHING_DRIVER)).toBe(true);
    }
    expect(
      isValidDeliveryTransition(DeliveryStatus.COLLECTED, DeliveryStatus.SEARCHING_DRIVER),
    ).toBe(false);
    expect(
      isValidDeliveryTransition(DeliveryStatus.IN_TRANSIT, DeliveryStatus.SEARCHING_DRIVER),
    ).toBe(false);
  });

  it('every delivery transition maps to a valid (or unchanged) order transition', () => {
    for (const [from, targets] of Object.entries(DELIVERY_TRANSITIONS) as [
      DeliveryStatus,
      DeliveryStatus[],
    ][]) {
      for (const to of targets) {
        const orderFrom = DELIVERY_TO_ORDER_STATUS[from] ?? OrderStatus.DRIVER_ARRIVING; // AT_PICKUP keeps DRIVER_ARRIVING
        const orderTo = DELIVERY_TO_ORDER_STATUS[to];
        if (orderTo === null || orderTo === orderFrom) continue; // order status unchanged
        expect({ from, to, valid: isValidOrderTransition(orderFrom, orderTo) }).toEqual({
          from,
          to,
          valid: true,
        });
      }
    }
  });
});

describe('customer tracking timeline', () => {
  const summary = (status: OrderStatus) =>
    buildTrackingSteps(status).map(
      (s) => `${s.state === 'done' ? 'x' : s.state === 'current' ? '>' : '.'}${s.label}`,
    );

  it('matches the product spec while the driver collects the order', () => {
    expect(summary(OrderStatus.DRIVER_ARRIVING)).toEqual([
      'xOrder placed',
      'xPayment confirmed',
      'xStore accepted',
      'xPreparing',
      'xDriver assigned',
      '>Driver collecting',
      '.In transit',
      '.Delivered',
    ]);
  });

  it('shows payment as the current step before payment', () => {
    expect(summary(OrderStatus.PENDING_PAYMENT)[1]).toBe('>Payment confirmed');
  });

  it('completes every step when delivered', () => {
    expect(buildTrackingSteps(OrderStatus.DELIVERED).every((s) => s.state === 'done')).toBe(true);
  });

  it('attaches a human hint to the current step only', () => {
    const steps = buildTrackingSteps(OrderStatus.DRIVER_REQUESTED);
    expect(steps.filter((s) => s.hint)).toHaveLength(1);
    expect(steps.find((s) => s.hint)!.hint).toMatch(/driver/i);
  });

  it('freezes progress for cancelled orders at the point they reached', () => {
    const steps = buildTrackingSteps(OrderStatus.CANCELLED, { reachedRank: 3 });
    expect(steps.map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });
});
