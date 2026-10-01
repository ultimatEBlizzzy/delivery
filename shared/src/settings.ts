/**
 * Platform settings schema. Each definition describes one admin-configurable value:
 * the backend validates writes against it and the admin UI renders its form from it.
 * Nothing financial is hard-coded in business logic – services read these values at runtime.
 */

export type SettingType = 'number' | 'boolean' | 'string' | 'json';
export type SettingGroup =
  'general' | 'fees' | 'commission' | 'orders' | 'dispatch' | 'delivery' | 'pricing';

export interface PeakWindow {
  /** 0 = Sunday … 6 = Saturday (platform timezone) */
  days: number[];
  /** 24h "HH:MM" */
  start: string;
  end: string;
}

export interface SettingDefinition {
  key: string;
  group: SettingGroup;
  label: string;
  description: string;
  type: SettingType;
  defaultValue: unknown;
  min?: number;
  max?: number;
  unit?: string;
  /** Exposed to unauthenticated clients through GET /settings/public. */
  public?: boolean;
}

export const SETTING_DEFINITIONS = [
  {
    key: 'general.platformName',
    group: 'general',
    label: 'Platform name',
    description: 'Shown in the apps and in notifications.',
    type: 'string',
    defaultValue: 'BuildRun',
    public: true,
  },
  {
    key: 'general.supportEmail',
    group: 'general',
    label: 'Support email',
    description: 'Contact address shown to customers, drivers and stores.',
    type: 'string',
    defaultValue: 'support@buildrun.example',
    public: true,
  },
  {
    key: 'general.supportPhone',
    group: 'general',
    label: 'Support phone',
    description: 'Contact number shown to customers, drivers and stores.',
    type: 'string',
    defaultValue: '+27 10 000 0000',
    public: true,
  },
  {
    key: 'fees.serviceFeePercent',
    group: 'fees',
    label: 'Service fee (%)',
    description: 'Percentage of the products subtotal charged to the customer as a service fee.',
    type: 'number',
    defaultValue: 3,
    min: 0,
    max: 30,
    unit: '%',
  },
  {
    key: 'fees.serviceFeeMin',
    group: 'fees',
    label: 'Minimum service fee',
    description: 'The service fee will never be lower than this amount.',
    type: 'number',
    defaultValue: 5,
    min: 0,
    max: 1000,
    unit: 'R',
  },
  {
    key: 'fees.serviceFeeMax',
    group: 'fees',
    label: 'Maximum service fee',
    description: 'The service fee will never be higher than this amount.',
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 5000,
    unit: 'R',
  },
  {
    key: 'commission.defaultStorePercent',
    group: 'commission',
    label: 'Default store commission (%)',
    description:
      'Platform commission on the products subtotal. Stores can have their own override.',
    type: 'number',
    defaultValue: 10,
    min: 0,
    max: 50,
    unit: '%',
  },
  {
    key: 'commission.driverSharePercent',
    group: 'commission',
    label: 'Driver share of delivery fee (%)',
    description:
      'Percentage of the delivery fee paid to the driver. The remainder is platform margin.',
    type: 'number',
    defaultValue: 80,
    min: 0,
    max: 100,
    unit: '%',
  },
  {
    key: 'orders.paymentTimeoutMinutes',
    group: 'orders',
    label: 'Payment timeout',
    description: 'Unpaid orders are cancelled and their stock released after this many minutes.',
    type: 'number',
    defaultValue: 30,
    min: 5,
    max: 1440,
    unit: 'min',
  },
  {
    key: 'orders.enforceStoreHours',
    group: 'orders',
    label: 'Enforce store operating hours',
    description: 'When on, customers cannot place orders while a store is closed.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'dispatch.offerTimeoutSeconds',
    group: 'dispatch',
    label: 'Driver offer timeout',
    description:
      'How long a driver has to accept a delivery request before it is offered to someone else.',
    type: 'number',
    defaultValue: 60,
    min: 10,
    max: 600,
    unit: 'sec',
  },
  {
    key: 'dispatch.searchRadiusKm',
    group: 'dispatch',
    label: 'Driver search radius',
    description: 'Only drivers within this distance of the store are offered the delivery.',
    type: 'number',
    defaultValue: 25,
    min: 1,
    max: 500,
    unit: 'km',
  },
  {
    key: 'dispatch.offerBatchSize',
    group: 'dispatch',
    label: 'Drivers offered at once',
    description: 'Number of drivers a request is sent to simultaneously. The first to accept wins.',
    type: 'number',
    defaultValue: 1,
    min: 1,
    max: 10,
  },
  {
    key: 'dispatch.maxOfferRounds',
    group: 'dispatch',
    label: 'Maximum offer rounds',
    description: 'After this many unanswered rounds the delivery is flagged for manual assignment.',
    type: 'number',
    defaultValue: 10,
    min: 1,
    max: 100,
  },
  {
    key: 'dispatch.driverLocationMaxAgeMinutes',
    group: 'dispatch',
    label: 'Driver location freshness',
    description: 'Drivers whose last location update is older than this are not considered.',
    type: 'number',
    defaultValue: 10,
    min: 1,
    max: 120,
    unit: 'min',
  },
  {
    key: 'dispatch.allowLargerVehicles',
    group: 'dispatch',
    label: 'Allow larger vehicles',
    description:
      'When on, a driver with a larger vehicle than requested may also receive the offer.',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'delivery.requireProofOfCollection',
    group: 'delivery',
    label: 'Require proof of collection',
    description: 'Drivers must upload a photo when collecting the order from the store.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'delivery.requireProofOfDelivery',
    group: 'delivery',
    label: 'Require proof of delivery',
    description: 'Drivers must upload a photo or signature when delivering the order.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'pricing.peakWindows',
    group: 'pricing',
    label: 'Peak-time windows',
    description:
      'Deliveries requested inside these windows (Africa/Johannesburg time) pay the peak surcharge.',
    type: 'json',
    defaultValue: [
      { days: [1, 2, 3, 4, 5], start: '07:00', end: '09:00' },
      { days: [1, 2, 3, 4, 5], start: '16:00', end: '18:00' },
    ] satisfies PeakWindow[],
  },
  {
    key: 'pricing.defaultItemWeightKg',
    group: 'pricing',
    label: 'Default item weight',
    description: 'Weight assumed for products that have no weight recorded.',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 100,
    unit: 'kg',
  },
] as const satisfies readonly SettingDefinition[];

export type SettingKey = (typeof SETTING_DEFINITIONS)[number]['key'];

export const SETTING_DEFAULTS: Readonly<Record<SettingKey, unknown>> = Object.fromEntries(
  SETTING_DEFINITIONS.map((d) => [d.key, d.defaultValue]),
) as Record<SettingKey, unknown>;

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return (SETTING_DEFINITIONS as readonly SettingDefinition[]).find((d) => d.key === key);
}

/** Validates a peak window list. Returns an error message or null. */
export function validatePeakWindows(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Peak windows must be a list';
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const w of value) {
    if (!w || typeof w !== 'object') return 'Each peak window must be an object';
    const { days, start, end } = w as PeakWindow;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      return 'Peak window days must be integers between 0 (Sunday) and 6 (Saturday)';
    if (
      typeof start !== 'string' ||
      !hhmm.test(start) ||
      typeof end !== 'string' ||
      !hhmm.test(end)
    )
      return 'Peak window times must use 24-hour HH:MM format';
    if (start >= end) return 'Peak window start must be before its end';
  }
  return null;
}

/** Validates a value against its definition. Returns an error message or null. */
export function validateSettingValue(def: SettingDefinition, value: unknown): string | null {
  switch (def.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        return `${def.label} must be a number`;
      if (def.min !== undefined && value < def.min)
        return `${def.label} must be at least ${def.min}`;
      if (def.max !== undefined && value > def.max)
        return `${def.label} must be at most ${def.max}`;
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${def.label} must be true or false`;
    case 'string':
      if (typeof value !== 'string') return `${def.label} must be text`;
      return value.length > 500 ? `${def.label} is too long` : null;
    case 'json':
      return def.key === 'pricing.peakWindows' ? validatePeakWindows(value) : null;
    default:
      return 'Unsupported setting type';
  }
}
