import { describe, expect, it } from 'vitest';
import {
  formatDistanceKm,
  formatDuration,
  formatRelative,
  formatWeight,
  humanize,
  initials,
  pluralize,
} from './format';

describe('format helpers', () => {
  it('formats distances', () => {
    expect(formatDistanceKm(0.45)).toBe('450 m');
    expect(formatDistanceKm(12.34)).toBe('12.3 km');
    expect(formatDistanceKm(250.6)).toBe('251 km');
    expect(formatDistanceKm(null)).toBe('–');
  });

  it('formats durations', () => {
    expect(formatDuration(25)).toBe('25 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(95)).toBe('1 h 35 min');
    expect(formatDuration(undefined)).toBe('–');
  });

  it('formats weights', () => {
    expect(formatWeight(2.5)).toBe('2.5 kg');
    expect(formatWeight(50)).toBe('50 kg');
    expect(formatWeight(1500)).toBe('1.5 t');
    expect(formatWeight(2000)).toBe('2 t');
  });

  it('formats relative times', () => {
    const now = new Date('2026-10-01T12:00:00Z').getTime();
    expect(formatRelative(new Date(now - 10_000), now)).toBe('just now');
    expect(formatRelative(new Date(now - 5 * 60_000), now)).toBe('5 minutes ago');
    expect(formatRelative(new Date(now + 2 * 3600_000), now)).toBe('in 2 hours');
    expect(formatRelative(null, now)).toBe('–');
  });

  it('builds initials, labels and plurals', () => {
    expect(initials('Thandi Mokoena')).toBe('TM');
    expect(initials('  sipho  ')).toBe('S');
    expect(initials(null)).toBe('?');
    expect(humanize('ORDER_READY')).toBe('Order ready');
    expect(pluralize(1, 'item')).toBe('1 item');
    expect(pluralize(3, 'item')).toBe('3 items');
  });
});
