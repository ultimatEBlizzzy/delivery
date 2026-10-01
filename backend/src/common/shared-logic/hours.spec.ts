import {
  DEFAULT_OPERATING_HOURS,
  describeHoursNow,
  discountPercent,
  effectivePrice,
  getStockStatus,
  getZonedParts,
  isOnSale,
  isOpenAt,
  maxOrderableQuantity,
  validateOperatingHours,
} from '@hardware-delivery/shared';
import { generateTemporaryPassword } from '../utils/password';
import { PASSWORD_REGEX } from '@hardware-delivery/shared';

// South Africa is UTC+2 all year (no daylight saving).
const sast = (iso: string) => new Date(`${iso}+02:00`);

describe('timezone handling (Africa/Johannesburg)', () => {
  it('reads weekday and wall-clock time in SAST regardless of server timezone', () => {
    // 2026-10-05 is a Monday
    expect(getZonedParts(sast('2026-10-05T08:30:00'))).toMatchObject({
      weekday: 'mon',
      dayOfWeek: 1,
      minutes: 8 * 60 + 30,
    });
    expect(getZonedParts(sast('2026-10-04T23:59:00'))).toMatchObject({
      weekday: 'sun',
      dayOfWeek: 0,
    });
    // 22:30 UTC on Sunday is already Monday 00:30 in SAST
    expect(getZonedParts(new Date('2026-10-04T22:30:00Z'))).toMatchObject({
      weekday: 'mon',
      minutes: 30,
    });
  });
});

describe('store opening hours', () => {
  it('is open during trading hours and closed outside them', () => {
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-05T07:29:00'))).toBe(false);
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-05T07:30:00'))).toBe(true);
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-05T16:59:00'))).toBe(true);
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-05T17:00:00'))).toBe(false);
  });

  it('honours short Saturdays and closed Sundays', () => {
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-03T12:59:00'))).toBe(true); // Saturday
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-03T13:00:00'))).toBe(false);
    expect(isOpenAt(DEFAULT_OPERATING_HOURS, sast('2026-10-04T10:00:00'))).toBe(false); // Sunday
  });

  it('describes the current state for the UI', () => {
    expect(describeHoursNow(DEFAULT_OPERATING_HOURS, sast('2026-10-05T06:00:00'))).toBe(
      'Opens at 07:30',
    );
    expect(describeHoursNow(DEFAULT_OPERATING_HOURS, sast('2026-10-05T10:00:00'))).toBe(
      'Open until 17:00',
    );
    expect(describeHoursNow(DEFAULT_OPERATING_HOURS, sast('2026-10-05T18:00:00'))).toBe(
      'Closed for today',
    );
    expect(describeHoursNow(DEFAULT_OPERATING_HOURS, sast('2026-10-04T10:00:00'))).toBe(
      'Closed today',
    );
  });

  it('validates opening-hours objects', () => {
    expect(validateOperatingHours(DEFAULT_OPERATING_HOURS)).toBeNull();
    expect(validateOperatingHours(null)).toMatch(/object/);
    expect(
      validateOperatingHours({
        ...DEFAULT_OPERATING_HOURS,
        mon: { closed: false, open: '17:00', close: '08:00' },
      }),
    ).toMatch(/closing time/);
    expect(
      validateOperatingHours({
        ...DEFAULT_OPERATING_HOURS,
        tue: { closed: false, open: '8am', close: '17:00' },
      }),
    ).toMatch(/HH:MM/);
    expect(validateOperatingHours({ ...DEFAULT_OPERATING_HOURS, wed: undefined })).toMatch(
      /Missing/,
    );
    // a closed day may keep placeholder times
    expect(
      validateOperatingHours({
        ...DEFAULT_OPERATING_HOURS,
        sun: { closed: true, open: '09:00', close: '09:00' },
      }),
    ).toBeNull();
  });
});

describe('listing helpers', () => {
  it('only treats a genuinely lower sale price as a sale', () => {
    expect(effectivePrice(100, 80)).toBe(80);
    expect(effectivePrice(100, null)).toBe(100);
    expect(effectivePrice(100, 100)).toBe(100);
    expect(effectivePrice(100, 120)).toBe(100);
    expect(isOnSale(100, 80)).toBe(true);
    expect(isOnSale(100, undefined)).toBe(false);
    expect(discountPercent(200, 150)).toBe(25);
    expect(discountPercent(200, null)).toBe(0);
  });

  it('computes how much can be ordered', () => {
    expect(maxOrderableQuantity(40, 1, 100)).toBe(40); // stock is the limit
    expect(maxOrderableQuantity(40, 1, 10)).toBe(10); // store maximum is the limit
    expect(maxOrderableQuantity(3, 5, null)).toBe(0); // below the store's minimum
    expect(maxOrderableQuantity(0, 1, null)).toBe(0);
  });

  it('classifies stock levels', () => {
    expect(getStockStatus(0, 5)).toBe('OUT_OF_STOCK');
    expect(getStockStatus(5, 5)).toBe('LOW_STOCK');
    expect(getStockStatus(6, 5)).toBe('IN_STOCK');
  });
});

describe('temporary passwords', () => {
  it('always satisfy the password policy and are random', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toHaveLength(14);
      expect(PASSWORD_REGEX.test(pw)).toBe(true);
      seen.add(pw);
    }
    expect(seen.size).toBe(200);
  });
});
