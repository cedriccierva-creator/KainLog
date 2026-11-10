import { describe, expect, it } from 'vitest';
import { formatEntryAmount, formatGrams, formatKcal, formatServings } from '../lib/format';
import {
  createLogEntry,
  entryNutrition,
  gramsFromServings,
  isGramServingLabel,
  isValidServings,
  kcalFromMacros,
  MAX_SERVINGS,
  parseGramAmount,
  roundServings,
  scaleNutrition,
  servingsFromGrams,
  snapshotFromFood,
  stepServings,
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
      servingGrams: 100,
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

describe('gram amounts', () => {
  it('converts grams to exact servings and back', () => {
    expect(servingsFromGrams(167, 100)).toBe(1.67);
    expect(gramsFromServings(1.67, 100)).toBeCloseTo(167, 10);
    expect(servingsFromGrams(47, 30)).toBeCloseTo(1.5666666666666667, 12);
  });

  it('formats non-terminating ratios without float noise', () => {
    const servingSizes = [30, 45, 85, 180];
    const amounts = [47, 47.5, 167];

    for (const servingGrams of servingSizes) {
      for (const grams of amounts) {
        const servings = servingsFromGrams(grams, servingGrams);
        expect(formatGrams(gramsFromServings(servings, servingGrams))).toBe(String(grams));
      }
    }

    // Raw double arithmetic can carry noise even when the ratio above cancels.
    expect(formatGrams(47.00000000000001)).toBe('47');
    expect(formatGrams(0.47 * 150)).toBe('70.5');
  });

  it('rejects blank, non-numeric, zero, negative and oversized gram input', () => {
    expect(parseGramAmount('')).toBeNull();
    expect(parseGramAmount('  ')).toBeNull();
    expect(parseGramAmount('abc')).toBeNull();
    expect(parseGramAmount('0')).toBeNull();
    expect(parseGramAmount('-5')).toBeNull();
    expect(parseGramAmount('10000.1')).toBeNull();
    expect(parseGramAmount('47.5')).toBe(47.5);
    expect(parseGramAmount('10000')).toBe(10000);
    expect(parseGramAmount('1e3')).toBe(1000);
    expect(parseGramAmount('47.')).toBe(47);
    expect(parseGramAmount('.5')).toBe(0.5);
  });

  it('treats only a bare gram amount as a gram label', () => {
    expect(isGramServingLabel('100 g')).toBe(true);
    expect(isGramServingLabel('85g')).toBe(true);
    expect(isGramServingLabel(' 250 G ')).toBe(true);
    expect(isGramServingLabel('1 cup')).toBe(false);
    expect(isGramServingLabel('1 piece (100 g)')).toBe(false);
    expect(isGramServingLabel('1 cup (≈4 pcs)')).toBe(false);
  });

  it('snaps only when the stepper is pressed', () => {
    expect(stepServings(1.67, 1)).toBe(2);
    expect(stepServings(1.67, -1)).toBe(1.5);
    expect(stepServings(1, 1)).toBe(1.25);
    expect(stepServings(0.25, -1)).toBe(0.25);
  });

  it('steps from 0.1 servings without ever reaching zero', () => {
    // 0.1 is below the first quarter step: "−" is disabled in the UI and, even
    // if forced, the minimum clamp keeps it at 0.25 rather than 0.
    expect(stepServings(0.1, -1)).toBe(0.25);
    expect(stepServings(0.1, 1)).toBe(0.25);
    expect(stepServings(0.1, 1)).toBeGreaterThan(0);
    expect(stepServings(0.1, -1)).toBeGreaterThan(0);
  });

  it('keeps exact grams-derived servings in a log entry', () => {
    const entry = createLogEntry(makeFood({ servingGrams: 100 }), {
      date: '2026-10-30',
      meal: 'lunch',
      servings: servingsFromGrams(167, 100),
      amountMode: 'grams',
    });

    expect(entry.servings).toBe(1.67);
    expect(entry.amountMode).toBe('grams');
    expect(entry.snapshot.servingGrams).toBe(100);
  });

  it('renders gram entries as total grams and other entries as servings', () => {
    const gramEntry = createLogEntry(makeFood({ servingLabel: '100 g', servingGrams: 100 }), {
      date: '2026-10-30',
      meal: 'lunch',
      servings: servingsFromGrams(167, 100),
      amountMode: 'grams',
    });
    expect(formatEntryAmount(gramEntry)).toBe('167 g');

    const servingEntry = createLogEntry(makeFood({ servingLabel: '1 cup', servingGrams: 100 }), {
      date: '2026-10-30',
      meal: 'lunch',
      servings: 1.5,
      amountMode: 'servings',
    });
    expect(formatEntryAmount(servingEntry)).toBe('1.5 × 1 cup');

    const legacy = createLogEntry(makeFood(), {
      date: '2026-10-30',
      meal: 'lunch',
      servings: 1,
    });
    const legacySnapshot = { ...legacy.snapshot };
    delete legacySnapshot.servingGrams;
    expect(formatEntryAmount({ ...legacy, snapshot: legacySnapshot, amountMode: undefined })).toBe(
      '1 × 1 serving',
    );
  });
});

describe('seeded servings guard', () => {
  it('rejects NaN, zero, negative, Infinity and over-max servings', () => {
    for (const value of [Number.NaN, 0, -1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(isValidServings(value), String(value)).toBe(false);
      expect(() =>
        createLogEntry(makeFood(), { date: '2026-10-30', meal: 'lunch', servings: value }),
      ).toThrow(RangeError);
    }

    expect(isValidServings(MAX_SERVINGS + 1)).toBe(false);
    expect(() =>
      createLogEntry(makeFood(), { date: '2026-10-30', meal: 'lunch', servings: MAX_SERVINGS + 1 }),
    ).toThrow(/at most 10000/);

    expect(isValidServings(MAX_SERVINGS)).toBe(true);
    expect(isValidServings(0.0001)).toBe(true);
    expect(createLogEntry(makeFood(), { date: '2026-10-30', meal: 'lunch', servings: 0.0001 }).servings).toBe(0.0001);
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
    expect(roundServings(0.1)).toBe(0.25);
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
