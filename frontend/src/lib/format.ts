import { formatZAR, PLATFORM_TIMEZONE } from '@hardware-delivery/shared';

export const formatMoney = formatZAR;

const dateFmt = new Intl.DateTimeFormat('en-ZA', {
  dateStyle: 'medium',
  timeZone: PLATFORM_TIMEZONE,
});
const dateTimeFmt = new Intl.DateTimeFormat('en-ZA', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: PLATFORM_TIMEZONE,
});
const timeFmt = new Intl.DateTimeFormat('en-ZA', {
  timeStyle: 'short',
  timeZone: PLATFORM_TIMEZONE,
});
const relativeFmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatDate = (v: string | Date | null | undefined) =>
  toDate(v) ? dateFmt.format(toDate(v)!) : '–';
export const formatDateTime = (v: string | Date | null | undefined) =>
  toDate(v) ? dateTimeFmt.format(toDate(v)!) : '–';
export const formatTime = (v: string | Date | null | undefined) =>
  toDate(v) ? timeFmt.format(toDate(v)!) : '–';

/** "5 minutes ago", "in 2 hours", "yesterday" */
export function formatRelative(value: string | Date | null | undefined, now = Date.now()): string {
  const d = toDate(value);
  if (!d) return '–';
  const diffSec = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return relativeFmt.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return relativeFmt.format(Math.round(diffSec / 86400), 'day');
  return formatDate(d);
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined || Number.isNaN(km)) return '–';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km >= 100 ? Math.round(km) : km.toFixed(1)} km`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '–';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return '–';
  if (kg >= 1000) return `${(kg / 1000).toFixed(2).replace(/\.?0+$/, '')} t`;
  return `${Number(kg.toFixed(1))} kg`;
}

export const pluralize = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** "ORDER_READY" -> "Order ready" */
export function humanize(value: string): string {
  const s = value.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
