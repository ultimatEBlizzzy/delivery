import {
  getSettingDefinition,
  SETTING_DEFAULTS,
  SETTING_DEFINITIONS,
  validatePeakWindows,
  validateSettingValue,
} from '@hardware-delivery/shared';

describe('settings schema', () => {
  it('every default passes its own validation', () => {
    for (const def of SETTING_DEFINITIONS) {
      expect({ key: def.key, error: validateSettingValue(def, def.defaultValue) }).toEqual({
        key: def.key,
        error: null,
      });
    }
  });

  it('keys are unique and dot-namespaced', () => {
    const keys = SETTING_DEFINITIONS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^[a-z]+\.[A-Za-z]+$/.test(k))).toBe(true);
    expect(Object.keys(SETTING_DEFAULTS)).toHaveLength(keys.length);
  });

  it('enforces numeric bounds and types', () => {
    const def = getSettingDefinition('fees.serviceFeePercent')!;
    expect(validateSettingValue(def, 5)).toBeNull();
    expect(validateSettingValue(def, -1)).toMatch(/at least/);
    expect(validateSettingValue(def, 31)).toMatch(/at most/);
    expect(validateSettingValue(def, '5')).toMatch(/number/);
    expect(validateSettingValue(def, Number.NaN)).toMatch(/number/);
  });

  it('validates peak windows', () => {
    expect(validatePeakWindows([{ days: [1, 2], start: '07:00', end: '09:00' }])).toBeNull();
    expect(validatePeakWindows([])).toBeNull();
    expect(validatePeakWindows('nope')).toMatch(/list/);
    expect(validatePeakWindows([{ days: [7], start: '07:00', end: '09:00' }])).toMatch(/days/);
    expect(validatePeakWindows([{ days: [], start: '07:00', end: '09:00' }])).toMatch(/days/);
    expect(validatePeakWindows([{ days: [1], start: '7am', end: '09:00' }])).toMatch(/HH:MM/);
    expect(validatePeakWindows([{ days: [1], start: '10:00', end: '09:00' }])).toMatch(/before/);
  });
});
