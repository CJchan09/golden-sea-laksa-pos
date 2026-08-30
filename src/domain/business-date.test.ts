import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_DAY_CUTOFF,
  businessDateStart,
  parseCutoffMinutes,
  toBusinessDate,
} from './business-date';

/** Local-time Date, matching how the counter device reads its own clock. */
function at(y: number, m: number, d: number, h: number, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

describe('parseCutoffMinutes', () => {
  it('parses 24-hour times', () => {
    expect(parseCutoffMinutes('00:00')).toBe(0);
    expect(parseCutoffMinutes('04:00')).toBe(240);
    expect(parseCutoffMinutes('23:59')).toBe(1439);
  });

  it('rejects malformed values', () => {
    for (const bad of ['4:00', '24:00', '04:60', '0400', 'noon', '']) {
      expect(() => parseCutoffMinutes(bad)).toThrow();
    }
  });
});

describe('toBusinessDate', () => {
  it('defaults to a 04:00 cutoff', () => {
    expect(DEFAULT_BUSINESS_DAY_CUTOFF).toBe('04:00');
  });

  it('keeps daytime orders on the calendar day', () => {
    expect(toBusinessDate(at(2026, 3, 21, 14, 5))).toBe('2026-03-21');
    expect(toBusinessDate(at(2026, 3, 21, 23, 59))).toBe('2026-03-21');
  });

  it('puts after-midnight orders on the previous business date', () => {
    // The supper trade: 02:30 belongs to the night that started on the 21st.
    expect(toBusinessDate(at(2026, 3, 22, 2, 30))).toBe('2026-03-21');
    expect(toBusinessDate(at(2026, 3, 22, 3, 59))).toBe('2026-03-21');
  });

  it('rolls over exactly at the cutoff', () => {
    expect(toBusinessDate(at(2026, 3, 22, 4, 0))).toBe('2026-03-22');
  });

  it('crosses month and year boundaries', () => {
    expect(toBusinessDate(at(2026, 4, 1, 1, 15))).toBe('2026-03-31');
    expect(toBusinessDate(at(2027, 1, 1, 2, 0))).toBe('2026-12-31');
  });

  it('handles a leap day', () => {
    expect(toBusinessDate(at(2028, 3, 1, 1, 0))).toBe('2028-02-29');
  });

  it('honours a custom cutoff', () => {
    expect(toBusinessDate(at(2026, 3, 22, 5, 30), '06:00')).toBe('2026-03-21');
    expect(toBusinessDate(at(2026, 3, 22, 6, 30), '06:00')).toBe('2026-03-22');
    // A midnight cutoff degenerates to the plain calendar day.
    expect(toBusinessDate(at(2026, 3, 22, 0, 1), '00:00')).toBe('2026-03-22');
  });
});

describe('businessDateStart', () => {
  it('returns the cutoff instant of that business date', () => {
    const start = businessDateStart('2026-03-21', '04:00');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(21);
    expect(start.getHours()).toBe(4);
    expect(start.getMinutes()).toBe(0);
  });

  it('rejects malformed dates', () => {
    expect(() => businessDateStart('21-03-2026')).toThrow();
  });

  it('agrees with toBusinessDate at the boundary', () => {
    const start = businessDateStart('2026-03-21', '04:00');
    expect(toBusinessDate(start, '04:00')).toBe('2026-03-21');

    const justBefore = new Date(start.getTime() - 60_000);
    expect(toBusinessDate(justBefore, '04:00')).toBe('2026-03-20');
  });
});
