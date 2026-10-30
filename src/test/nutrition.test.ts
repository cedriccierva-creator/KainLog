import { describe, expect, it } from 'vitest';
import { formatGrams, formatKcal, formatServings } from '../lib/format';
import {
  createLogEntry,
  entryNutrition,
  kcalFromMacros,
  roundServings,
  scaleNutrition,
  snapshotFromFood,
  sumNutrition,
  ZERO_NUTRITION,
} from '../lib/nutrition';
import type { Food } from '../types';

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
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
    fiberG: 2,
    sodiumMg: 300,
    isFilipino: true,
    source: 'user',
    verified: false,
    ...overrides,
  };
}

describe('kcalFromMacros', () => {
  it('uses 4/4/9', () => {
    expect(kcalFromMacros(30, 55, 26)).toBe(574);
  });

  it('handles an empty profile', () => {
    expect(kcalFromMacros(0, 0, 0)).toBe(0);
  });

  it('rounds to a whole kcal', () => {
    expect(kcalFromMacros(6.3, 0.6, 7)).toBe(91);
  });
});

describe('snapshotFromFood', () => {
  it('copies the per-serving values and labels', () => {
    const food = makeFood({ name: 'Pork Adobo', servingLabel: '1 cup' });
    expect(snapshotFromFood(food)).toEqual({
      foodName: 'Pork Adobo',
      servingLabel: '1 cup',
      kcal: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 8,
      fiberG: 2,
      sodiumMg: 300,
    });
  });

  it('defaults optional fiber and sodium to zero', () => {
    const food = makeFood({ fiberG: undefined, sodiumMg: undefined });
    const snapshot = snapshotFromFood(food);
    expect(snapshot.fiberG).toBe(0);
    expect(snapshot.sodiumMg).toBe(0);
  });
});

describe('createLogEntry', () => {
  it('freezes the food values at logging time', () => {
    const food = makeFood();
    const entry = createLogEntry(food, { date: '2026-10-31', meal: 'lunch', servings: 1 });

    food.kcal = 999;
    food.proteinG = 80;

    expect(entry.snapshot.kcal).toBe(200);
    expect(entryNutrition(entry).kcal).toBe(200);
  });

  it('stores the day key and meal it was given', () => {
    const entry = createLogEntry(makeFood(), { date: '2026-10-31', meal: 'dinner', servings: 2 });
    expect(entry.date).toBe('2026-10-31');
    expect(entry.meal).toBe('dinner');
    expect(entry.servings).toBe(2);
  });
});

describe('roundServings', () => {
  it('snaps to quarter steps', () => {
    expect(roundServings(0.3)).toBe(0.25);
    expect(roundServings(0.6)).toBe(0.5);
    expect(roundServings(1.1)).toBe(1);
    expect(roundServings(2.25)).toBe(2.25);
  });

  it('never goes below one step', () => {
    expect(roundServings(0)).toBe(0.25);
    expect(roundServings(-3)).toBe(0.25);
  });
});

describe('scaleNutrition', () => {
  it('multiplies every value by the serving count', () => {
    const oneServing = scaleNutrition(
      { kcal: 200, proteinG: 10, carbsG: 20, fatG: 8, fiberG: 2, sodiumMg: 300 },
      2,
    );
    expect(oneServing).toEqual({
      kcal: 400,
      proteinG: 20,
      carbsG: 40,
      fatG: 16,
      fiberG: 4,
      sodiumMg: 600,
    });
  });

  it('keeps full precision for quarter servings (display rounds, storage does not)', () => {
    const quarter = scaleNutrition(
      { kcal: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4, fiberG: 0.6, sodiumMg: 1 },
      0.25,
    );
    expect(quarter.kcal).toBe(51.25);
    expect(quarter.proteinG).toBeCloseTo(1.075, 10);
    expect(quarter.carbsG).toBe(11.25);

    // Only the display layer rounds.
    expect(formatKcal(quarter.kcal)).toBe('51');
    expect(formatGrams(quarter.proteinG)).toBe('1.1');
    expect(formatGrams(quarter.carbsG)).toBe('11.3');
  });

  it('scales to zero without floating point noise', () => {
    expect(scaleNutrition(ZERO_NUTRITION, 3)).toEqual(ZERO_NUTRITION);
  });
});

describe('entryNutrition', () => {
  it('rescales when servings change, without touching the snapshot', () => {
    const entry = createLogEntry(makeFood(), { date: '2026-10-31', meal: 'lunch', servings: 1 });
    const double = { ...entry, servings: 2 };
    const quarter = { ...entry, servings: 0.25 };

    expect(entryNutrition(double).kcal).toBe(400);
    expect(entryNutrition(quarter).kcal).toBe(50);
    expect(entryNutrition(quarter).proteinG).toBe(2.5);
    expect(entry.snapshot.kcal).toBe(200);
  });
});

describe('sumNutrition', () => {
  it('adds entries together without rounding', () => {
    const total = sumNutrition([
      { kcal: 200, proteinG: 10, carbsG: 20, fatG: 8, fiberG: 2, sodiumMg: 300 },
      { kcal: 51.25, proteinG: 1.075, carbsG: 11.25, fatG: 0.1, fiberG: 0.15, sodiumMg: 0.25 },
    ]);
    expect(total.kcal).toBeCloseTo(251.25, 10);
    expect(total.proteinG).toBeCloseTo(11.075, 10);
    expect(total.carbsG).toBeCloseTo(31.25, 10);
    expect(total.fatG).toBeCloseTo(8.1, 10);
  });

  it('sums four quarter servings to exactly one serving', () => {
    const food = makeFood({ kcal: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4, fiberG: 0.6, sodiumMg: 1 });
    const quarters = [0.25, 0.25, 0.25, 0.25].map((servings) =>
      createLogEntry(food, { date: '2026-10-31', meal: 'snack', servings }),
    );

    const total = sumNutrition(quarters.map(entryNutrition));
    expect(total.kcal).toBe(205);
    expect(total.proteinG).toBeCloseTo(4.3, 10);
    expect(formatKcal(total.kcal)).toBe('205');
  });

  it('returns zeros for an empty day', () => {
    expect(sumNutrition([])).toEqual(ZERO_NUTRITION);
  });
});

describe('display formatting', () => {
  it('formats servings in quarter steps', () => {
    expect(formatServings(1)).toBe('1');
    expect(formatServings(1.25)).toBe('1.25');
    expect(formatServings(0.5)).toBe('0.5');
  });

  it('trims trailing zeros for grams', () => {
    expect(formatGrams(20)).toBe('20');
    expect(formatGrams(1.5)).toBe('1.5');
    expect(formatGrams(1.04)).toBe('1');
  });
});
