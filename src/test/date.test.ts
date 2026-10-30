import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  dateKeyToDate,
  formatDayLabel,
  isToday,
  lastNDays,
  localDateKey,
} from '../lib/date';
import { createLogEntry } from '../lib/nutrition';
import type { Food } from '../types';

/**
 * `npm test` runs the suite twice: once with TZ=Asia/Manila (UTC+8) and once
 * with TZ=America/New_York (UTC-4/-5), so both a positive and a negative UTC
 * offset are covered. The TZ-specific blocks below only run in the matching pass.
 */
const TZ = process.env.TZ ?? '(system)';

const sampleFood: Food = {
  id: 'test-food',
  name: 'Test Food',
  aliases: [],
  category: 'ulam',
  servingLabel: '1 serving',
  servingGrams: 100,
  altServings: [],
  kcal: 200,
  proteinG: 10,
  carbsG: 20,
  fatG: 8,
  isFilipino: true,
  source: 'user',
  verified: false,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('localDateKey', () => {
  it('uses the local calendar day at 11:59 pm', () => {
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 30));
    expect(localDateKey()).toBe('2026-10-31');
  });

  it('rolls over at local midnight', () => {
    vi.setSystemTime(new Date(2026, 10, 1, 0, 0, 0));
    expect(localDateKey()).toBe('2026-11-01');
  });

  it('pads single-digit months and days', () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('keeps a meal logged at 11:59 pm on that local date', () => {
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 0));
    const entry = createLogEntry(sampleFood, { date: localDateKey(), meal: 'snack', servings: 1 });
    expect(entry.date).toBe('2026-10-31');
  });

  it('keeps a meal logged at 00:30 on that local date', () => {
    vi.setSystemTime(new Date(2026, 9, 31, 0, 30, 0));
    const entry = createLogEntry(sampleFood, { date: localDateKey(), meal: 'breakfast', servings: 1 });
    expect(entry.date).toBe('2026-10-31');
  });
});

describe(`instants near UTC midnight (TZ=${TZ})`, () => {
  it.skipIf(TZ !== 'Asia/Manila')('00:30 Manila is 2026-10-31, although UTC is still 2026-10-30', () => {
    // 16:30Z on the previous UTC day = 00:30 on 2026-10-31 in Manila.
    const instant = new Date('2026-10-30T16:30:00Z');
    expect(localDateKey(instant)).toBe('2026-10-31');
    // The UTC day of this instant is 2026-10-30, which is why toISOString() is banned.
  });

  it.skipIf(TZ !== 'Asia/Manila')('23:59 Manila stays on 2026-10-30 (UTC 15:59)', () => {
    expect(localDateKey(new Date('2026-10-30T15:59:00Z'))).toBe('2026-10-30');
  });

  it.skipIf(TZ !== 'Asia/Manila')('00:30 Manila is still 2026-10-30 in UTC but a new local day', () => {
    expect(localDateKey(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11-01');
  });

  it.skipIf(TZ !== 'America/New_York')('00:30 New York is 2026-10-31, although UTC is 04:30 the same day', () => {
    expect(localDateKey(new Date('2026-10-31T04:30:00Z'))).toBe('2026-10-31');
  });

  it.skipIf(TZ !== 'America/New_York')('23:59 New York (03:59Z next day) stays on 2026-10-30', () => {
    expect(localDateKey(new Date('2026-10-31T03:59:00Z'))).toBe('2026-10-30');
  });

  it.skipIf(TZ !== 'America/New_York')('00:30 New York on 2026-11-01 is 04:30Z', () => {
    expect(localDateKey(new Date('2026-11-01T04:30:00Z'))).toBe('2026-11-01');
  });
});

describe('dateKeyToDate', () => {
  it('round-trips through local noon', () => {
    const date = dateKeyToDate('2026-10-31');
    expect(date.getHours()).toBe(12);
    expect(localDateKey(date)).toBe('2026-10-31');
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('subtracts days', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('survives the US DST switch', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('lastNDays', () => {
  it('returns the last 7 days ending today, oldest first', () => {
    const days = lastNDays('2026-10-31', 7);
    expect(days).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
  });

  it('keeps 7 distinct days across a DST change', () => {
    const days = lastNDays('2026-03-09', 7);
    expect(new Set(days).size).toBe(7);
    expect(days.at(-1)).toBe('2026-03-09');
  });
});

describe('isToday', () => {
  it('compares against the device day', () => {
    vi.setSystemTime(new Date(2026, 9, 31, 9, 0, 0));
    expect(isToday('2026-10-31')).toBe(true);
    expect(isToday('2026-10-30')).toBe(false);
  });
});

describe('formatDayLabel', () => {
  it('formats a short human label', () => {
    expect(formatDayLabel('2026-10-31')).toMatch(/Oct 31/);
  });
});
