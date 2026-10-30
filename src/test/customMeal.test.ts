import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KainLogDB } from '../db/db';
import { createCustomMeal, logCustomMeal, logFood } from '../db/logActions';
import { seedDatabase } from '../db/seed';
import { entryNutrition, sumNutrition } from '../lib/nutrition';
import type { Food } from '../types';

let database: KainLogDB;
let run = 0;

beforeEach(async () => {
  run += 1;
  database = new KainLogDB(`kainlog-test-meal-${run}`);
  await seedDatabase(database);
});

afterEach(async () => {
  await database.delete();
});

async function requireFood(id: string): Promise<Food> {
  const food = await database.foods.get(id);
  if (!food) throw new Error(`Seed food ${id} missing`);
  return food;
}

describe('custom meal expansion', () => {
  it('writes one snapshot entry per item when the meal is logged', async () => {
    const rice = await requireFood('seed-plain-rice');
    const adobo = await requireFood('seed-pork-adobo');

    const meal = await createCustomMeal(
      {
        name: 'Adobo rice',
        items: [
          { foodId: rice.id, servings: 1 },
          { foodId: adobo.id, servings: 0.5 },
        ],
      },
      database,
    );

    const result = await logCustomMeal(meal, { date: '2026-10-31', meal: 'lunch' }, database);

    expect(result).toEqual({ written: 2, skipped: 0 });

    const entries = await database.logEntries.where('date').equals('2026-10-31').toArray();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.snapshot.foodName).sort()).toEqual([
      'Plain Rice (1 cup cooked)',
      'Pork Adobo',
    ]);
    expect(entries.every((entry) => entry.meal === 'lunch')).toBe(true);
    expect(entries.every((entry) => entry.date === '2026-10-31')).toBe(true);

    const total = sumNutrition(entries.map(entryNutrition));
    expect(total.kcal).toBeCloseTo(rice.kcal + adobo.kcal * 0.5, 10);
  });

  it('skips items whose food no longer exists', async () => {
    const rice = await requireFood('seed-plain-rice');
    const adobo = await requireFood('seed-pork-adobo');
    const meal = await createCustomMeal(
      {
        name: 'Broken meal',
        items: [
          { foodId: rice.id, servings: 1 },
          { foodId: adobo.id, servings: 1 },
        ],
      },
      database,
    );

    await database.foods.delete(adobo.id);

    expect(await logCustomMeal(meal, { date: '2026-10-31', meal: 'dinner' }, database)).toEqual({
      written: 1,
      skipped: 1,
    });
    const entries = await database.logEntries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.snapshot.foodName).toBe('Plain Rice (1 cup cooked)');
  });

  it('keeps meal entries independent from later food edits', async () => {
    const adobo = await requireFood('seed-pork-adobo');
    const meal = await createCustomMeal(
      { name: 'Adobo only', items: [{ foodId: adobo.id, servings: 1 }] },
      database,
    );

    await logCustomMeal(meal, { date: '2026-10-31', meal: 'lunch' }, database);
    const original = adobo.kcal;

    await database.foods.update(adobo.id, { kcal: original + 500 });

    const [entry] = await database.logEntries.toArray();
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entryNutrition(entry).kcal).toBe(original);
  });
});

describe('quarter-serving logging', () => {
  it('adds up four quarter servings to one full serving', async () => {
    const rice = await requireFood('seed-plain-rice');

    for (let index = 0; index < 4; index += 1) {
      await logFood(rice, { date: '2026-10-31', meal: 'snack' }, 0.25, database);
    }

    const entries = await database.logEntries.where('date').equals('2026-10-31').toArray();
    expect(entries).toHaveLength(4);

    const total = sumNutrition(entries.map(entryNutrition));
    expect(total.kcal).toBeCloseTo(rice.kcal, 10);
    expect(total.proteinG).toBeCloseTo(rice.proteinG, 10);
  });
});
