import {
  DEFAULT_OPERATING_HOURS,
  PLATFORM_TIMEZONE,
  WEEKDAYS,
  type OperatingHours,
  type Weekday,
} from './constants';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ZonedParts {
  /** 'mon' … 'sun' */
  weekday: Weekday;
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  /** Minutes since local midnight */
  minutes: number;
}

const weekdayFormatCache = new Map<string, Intl.DateTimeFormat>();

/** The weekday and wall-clock time of an instant in the given timezone (default: South Africa). */
export function getZonedParts(date: Date, timeZone: string = PLATFORM_TIMEZONE): ZonedParts {
  let fmt = weekdayFormatCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    weekdayFormatCache.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const short = get('weekday').toLowerCase().slice(0, 3) as Weekday;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const idx = WEEKDAYS.indexOf(short);
  return { weekday: short, dayOfWeek: idx === 6 ? 0 : idx + 1, minutes: hour * 60 + minute };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** True when the store trades at `date` according to its weekly opening hours. */
export function isOpenAt(
  hours: OperatingHours | null | undefined,
  date: Date = new Date(),
): boolean {
  const h = hours ?? DEFAULT_OPERATING_HOURS;
  const { weekday, minutes } = getZonedParts(date);
  const day = h[weekday];
  if (!day || day.closed) return false;
  return minutes >= toMinutes(day.open) && minutes < toMinutes(day.close);
}

/** "Open until 17:00", "Opens at 07:30", "Closed today" */
export function describeHoursNow(
  hours: OperatingHours | null | undefined,
  date: Date = new Date(),
): string {
  const h = hours ?? DEFAULT_OPERATING_HOURS;
  const { weekday, minutes } = getZonedParts(date);
  const day = h[weekday];
  if (!day || day.closed) return 'Closed today';
  if (minutes < toMinutes(day.open)) return `Opens at ${day.open}`;
  if (minutes < toMinutes(day.close)) return `Open until ${day.close}`;
  return 'Closed for today';
}

/** Returns an error message, or null when the hours are valid. */
export function validateOperatingHours(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Operating hours must be an object';
  for (const day of WEEKDAYS) {
    const d = (value as Record<string, unknown>)[day] as
      { closed?: unknown; open?: unknown; close?: unknown } | undefined;
    if (!d || typeof d !== 'object') return `Missing hours for ${day}`;
    if (typeof d.closed !== 'boolean') return `${day}: "closed" must be true or false`;
    if (
      typeof d.open !== 'string' ||
      !HHMM.test(d.open) ||
      typeof d.close !== 'string' ||
      !HHMM.test(d.close)
    ) {
      return `${day}: times must use 24-hour HH:MM format`;
    }
    if (!d.closed && d.open >= d.close) return `${day}: closing time must be after opening time`;
  }
  return null;
}
