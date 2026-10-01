import { VehicleType } from './enums';

export const API_PREFIX = 'api/v1';

// ---- Validation policy (mirrored by backend DTOs and frontend Zod schemas) ----------------------
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
/** At least one lower-case letter, one upper-case letter and one digit. */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const PASSWORD_POLICY_MESSAGE =
  'Password must be 8–128 characters and include an upper-case letter, a lower-case letter and a number.';

/**
 * South African phone numbers: local (0821234567) or international (+27821234567 / 27821234567).
 * Landlines (01x–05x) and mobiles (06x–08x) are accepted.
 */
export const SA_PHONE_REGEX = /^(?:\+?27|0)[1-8]\d{8}$/;
export const SA_PHONE_MESSAGE = 'Enter a valid South African phone number, e.g. 082 123 4567';

/** Normalises a South African phone number to E.164 (+27…). Returns null when invalid. */
export function normalizeSaPhone(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, '');
  if (!SA_PHONE_REGEX.test(compact)) return null;
  const digits = compact.replace(/^\+?27/, '').replace(/^0/, '');
  return `+27${digits}`;
}

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

// ---- Pagination ---------------------------------------------------------------------------------
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ---- Vehicles -----------------------------------------------------------------------------------
/** Smallest to largest. Used to pick "the smallest vehicle that can carry this load". */
export const VEHICLE_TYPE_ORDER: readonly VehicleType[] = [
  VehicleType.MOTORCYCLE,
  VehicleType.CAR,
  VehicleType.BAKKIE,
  VehicleType.PANEL_VAN,
  VehicleType.TRUCK,
];

export const VEHICLE_TYPE_LABELS: Readonly<Record<VehicleType, string>> = {
  [VehicleType.MOTORCYCLE]: 'Motorcycle',
  [VehicleType.CAR]: 'Car',
  [VehicleType.BAKKIE]: 'Bakkie',
  [VehicleType.PANEL_VAN]: 'Panel van',
  [VehicleType.TRUCK]: 'Truck',
};

export interface VehicleProfile {
  baseFee: number;
  perKmFee: number;
  vehicleSurcharge: number;
  heavyLoadThresholdKg: number;
  heavyLoadSurcharge: number;
  peakSurcharge: number;
  minimumFee: number;
  maxWeightKg: number;
  maxLengthM: number;
  maxVolumeM3: number;
}

/**
 * Defaults inserted by the initial migration into `delivery_pricing`. Admins edit the live rows;
 * these values are never read by business logic at runtime.
 */
export const DEFAULT_VEHICLE_PROFILES: Readonly<Record<VehicleType, VehicleProfile>> = {
  [VehicleType.MOTORCYCLE]: {
    baseFee: 30,
    perKmFee: 6,
    vehicleSurcharge: 0,
    heavyLoadThresholdKg: 15,
    heavyLoadSurcharge: 50,
    peakSurcharge: 10,
    minimumFee: 35,
    maxWeightKg: 20,
    maxLengthM: 0.6,
    maxVolumeM3: 0.05,
  },
  [VehicleType.CAR]: {
    baseFee: 30,
    perKmFee: 8,
    vehicleSurcharge: 10,
    heavyLoadThresholdKg: 60,
    heavyLoadSurcharge: 50,
    peakSurcharge: 15,
    minimumFee: 40,
    maxWeightKg: 150,
    maxLengthM: 1.6,
    maxVolumeM3: 0.5,
  },
  [VehicleType.BAKKIE]: {
    baseFee: 30,
    perKmFee: 8,
    vehicleSurcharge: 40,
    heavyLoadThresholdKg: 300,
    heavyLoadSurcharge: 50,
    peakSurcharge: 20,
    minimumFee: 60,
    maxWeightKg: 1000,
    maxLengthM: 3.0,
    maxVolumeM3: 2.5,
  },
  [VehicleType.PANEL_VAN]: {
    baseFee: 30,
    perKmFee: 9,
    vehicleSurcharge: 60,
    heavyLoadThresholdKg: 500,
    heavyLoadSurcharge: 50,
    peakSurcharge: 25,
    minimumFee: 80,
    maxWeightKg: 1300,
    maxLengthM: 3.2,
    maxVolumeM3: 6,
  },
  [VehicleType.TRUCK]: {
    baseFee: 30,
    perKmFee: 15,
    vehicleSurcharge: 250,
    heavyLoadThresholdKg: 2000,
    heavyLoadSurcharge: 150,
    peakSurcharge: 50,
    minimumFee: 300,
    maxWeightKg: 6000,
    maxLengthM: 7.0,
    maxVolumeM3: 20,
  },
};

// ---- Operating hours ----------------------------------------------------------------------------
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  closed: boolean;
  /** 24h "HH:MM" */
  open: string;
  close: string;
}
export type OperatingHours = Record<Weekday, DayHours>;

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  mon: { closed: false, open: '07:30', close: '17:00' },
  tue: { closed: false, open: '07:30', close: '17:00' },
  wed: { closed: false, open: '07:30', close: '17:00' },
  thu: { closed: false, open: '07:30', close: '17:00' },
  fri: { closed: false, open: '07:30', close: '17:00' },
  sat: { closed: false, open: '08:00', close: '13:00' },
  sun: { closed: true, open: '08:00', close: '13:00' },
};

export const PLATFORM_TIMEZONE = 'Africa/Johannesburg';

// ---- Files --------------------------------------------------------------------------------------
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DEFAULT_CURRENCY = 'ZAR';
export const ORDER_NUMBER_PREFIX = 'HD';
