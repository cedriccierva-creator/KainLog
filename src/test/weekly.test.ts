import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { seedFoods } from '../db/seed';
import { lastNDays } from '../lib/date';
import { createLogEntry } from '../lib/nutrition';
import { movingAverage, summarizeDays, weightChange } from '../lib/weekly';

const dates = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];

function adobo() {
  return seedFoods.find((food) => food.id === 'seed-pork-adobo');
}

describe('summarizeDays', () => {
  it('marks days with no entries as null and leaves them out of the average', () => {
    const food = adobo();
    expect(food).toBeDefined();
    if (!food) return;

    const entries = [
      createLogEntry(food, { date: dates[0], meal: 'lunch', servings: 1 }),
      createLogEntry(food, { date: dates[0], meal: 'dinner', servings: 0.5 }),
      createLogEntry(food, { date: dates[3], meal: 'breakfast', servings: 2 }),
    ];

    const summary = summarizeDays(dates, entries);

    expect(summary.days[0].kcal).toBeCloseTo(food.kcal * 1.5, 6);
    expect(summary.days[1].kcal).toBeNull();
    expect(summary.days[3].kcal).toBeCloseTo(food.kcal * 2, 6);
    expect(summary.daysWithData).toBe(2);
    expect(summary.daysWithoutData).toBe(5);
    // Average is over the two logged days only: (1.5 + 2) / 2 servings.
    expect(summary.averageKcal).toBeCloseTo((food.kcal * 1.5 + food.kcal * 2) / 2, 6);
  });

  it('returns a null average when nothing is logged', () => {
    const summary = summarizeDays(dates, []);
    expect(summary.averageKcal).toBeNull();
    expect(summary.days.every((day) => day.kcal === null)).toBe(true);
    expect(summary.daysWithoutData).toBe(7);
  });

  it('uses local day keys from lastNDays', () => {
    expect(lastNDays('2026-10-31', 7)).toEqual(dates);
  });
});

describe('movingAverage', () => {
  const weighIns = Array.from({ length: 10 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    kg: 70 + index,
  }));

  it('averages the trailing 7 calendar days ending on each entry', () => {
    const points = movingAverage(weighIns);

    // Jan 7 window = Jan 1..7 → mean(70..76) = 73.
    expect(points[6].movingAverage).toBe(73);
    // Jan 10 window = Jan 4..10 → mean(73..79) = 76.
    expect(points[9].movingAverage).toBe(76);
  });

  it('handles gaps by averaging the entries that fall inside the window', () => {
    const sparse = [
      { date: '2026-02-01', kg: 70 },
      { date: '2026-02-08', kg: 72 },
    ];
    const points = movingAverage(sparse);
    // Feb 8 window is Feb 2..8, so only the Feb 8 entry qualifies.
    expect(points[1].movingAverage).toBe(72);
  });

  it('reports the signed change between first and last weigh-in', () => {
    expect(weightChange(weighIns)).toBe(9);
    expect(weightChange([{ kg: 70 }])).toBeNull();
  });
});
