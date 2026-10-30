import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KainLogDB } from '../db/db';
import { createLogEntry, entryNutrition, roundServings } from '../lib/nutrition';
import type { Food } from '../types';

let database: KainLogDB;
let run = 0;

beforeEach(() => {
  run += 1;
  database = new KainLogDB(`kainlog-test-snapshot-${run}`);
});

afterEach(async () => {
  await database.delete();
});

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Test Adobo',
    aliases: ['test adobong baboy'],
    category: 'ulam',
    servingLabel: '1 cup',
    servingGrams: 180,
    altServings: [{ label: '1/2 cup', grams: 90 }],
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

describe('log entry snapshots', () => {
  it('does not change totals on previously logged days when the food is edited', async () => {
    const food = makeFood();
    await database.foods.add(food);
    const oldEntry = createLogEntry(food, { date: '2026-10-30', meal: 'lunch', servings: 1 });
    await database.logEntries.add(oldEntry);

    // User later "fixes" the food's calories.
    await database.foods.update(food.id, { kcal: 900, proteinG: 80, carbsG: 0, fatG: 50 });

    const stored = await database.logEntries.get(oldEntry.id);
    expect(stored).toBeDefined();
    if (!stored) return;

    expect(entryNutrition(stored)).toEqual({
      kcal: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 8,
      fiberG: 2,
      sodiumMg: 300,
    });
    expect(stored.snapshot.foodName).toBe('Test Adobo');
  });

  it('logs the edited values from then on, while the older entry keeps the old values', async () => {
    const food = makeFood();
    await database.foods.add(food);
    const before = createLogEntry(food, { date: '2026-10-30', meal: 'lunch', servings: 1 });
    await database.logEntries.add(before);

    const edited = makeFood({ kcal: 300, proteinG: 15, carbsG: 30, fatG: 12 });
    await database.foods.put({ ...edited, id: food.id });
    const after = createLogEntry(edited, { date: '2026-10-31', meal: 'lunch', servings: 1 });
    await database.logEntries.add(after);

    const day30 = await database.logEntries.where('date').equals('2026-10-30').toArray();
    const day31 = await database.logEntries.where('date').equals('2026-10-31').toArray();

    expect(day30.map(entryNutrition)[0]?.kcal).toBe(200);
    expect(day31.map(entryNutrition)[0]?.kcal).toBe(300);
  });

  it('rescales totals when servings are edited, keeping the per-serving snapshot', async () => {
    const food = makeFood();
    await database.foods.add(food);
    const entry = createLogEntry(food, { date: '2026-10-31', meal: 'lunch', servings: 2 });
    await database.logEntries.add(entry);

    expect(entryNutrition(entry).kcal).toBe(400);

    await database.logEntries.update(entry.id, { servings: roundServings(0.5) });
    const stored = await database.logEntries.get(entry.id);
    expect(stored).toBeDefined();
    if (!stored) return;

    expect(stored.servings).toBe(0.5);
    expect(entryNutrition(stored).kcal).toBe(100);
    expect(stored.snapshot.kcal).toBe(200);
  });

  it('keeps entries readable after the food row is deleted', async () => {
    const food = makeFood();
    await database.foods.add(food);
    const entry = createLogEntry(food, { date: '2026-10-31', meal: 'dinner', servings: 1.5 });
    await database.logEntries.add(entry);

    await database.foods.delete(food.id);

    expect(await database.foods.count()).toBe(0);
    const stored = await database.logEntries.get(entry.id);
    expect(stored).toBeDefined();
    if (!stored) return;

    expect(stored.snapshot.foodName).toBe('Test Adobo');
    expect(stored.snapshot.servingLabel).toBe('1 cup');
    expect(entryNutrition(stored).kcal).toBe(300);
  });

  it('stores entries under the local day key it was given', async () => {
    const food = makeFood();
    await database.foods.add(food);
    await database.logEntries.add(
      createLogEntry(food, { date: '2026-10-31', meal: 'snack', servings: 1 }),
    );

    const sameDay = await database.logEntries.where('date').equals('2026-10-31').toArray();
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0]?.date).toBe('2026-10-31');
  });
});
