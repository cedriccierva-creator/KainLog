import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KainLogDB } from '../db/db';
import { setFoodHidden } from '../db/logActions';
import { DEFAULT_PROFILE, SEED_VERSION, seedDatabase, seedFoods } from '../db/seed';

let database: KainLogDB;
let run = 0;

beforeEach(() => {
  run += 1;
  database = new KainLogDB(`kainlog-test-seed-${run}`);
});

afterEach(async () => {
  await database.delete();
});

const firstSeedFood = seedFoods[0];

describe('seedDatabase', () => {
  it('inserts every seed food and records the seed version', async () => {
    await seedDatabase(database);

    expect(await database.foods.count()).toBe(seedFoods.length);
    expect((await database.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('is idempotent', async () => {
    await seedDatabase(database);
    const afterFirst = await database.foods.count();

    await seedDatabase(database);
    await seedDatabase(database);

    expect(await database.foods.count()).toBe(afterFirst);
    const ids = (await database.foods.toCollection().primaryKeys()) as string[];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps user edits to seed foods', async () => {
    await seedDatabase(database);
    await database.foods.update(firstSeedFood.id, {
      kcal: 999,
      proteinG: 88,
      source: 'user',
      name: 'My Edited Adobo',
    });

    await seedDatabase(database);

    const stored = await database.foods.get(firstSeedFood.id);
    expect(stored?.kcal).toBe(999);
    expect(stored?.proteinG).toBe(88);
    expect(stored?.source).toBe('user');
    expect(stored?.name).toBe('My Edited Adobo');
  });

  it('refreshes an unedited seed row when the stored version is older', async () => {
    await seedDatabase(database);
    const seed = seedFoods.find((food) => food.id === 'seed-pork-adobo');
    expect(seed).toBeDefined();
    if (!seed) return;

    // Simulate stale data written by an older app version (still an estimate).
    await database.foods.update(seed.id, {
      kcal: 1,
      aliases: [],
      altServings: [],
      notes: 'stale',
      servingGrams: 1,
    });
    await database.meta.put({ key: 'seedVersion', value: 1 });

    await seedDatabase(database);

    const refreshed = await database.foods.get(seed.id);
    expect(refreshed?.kcal).toBe(seed.kcal);
    expect(refreshed?.servingGrams).toBe(seed.servingGrams);
    expect(refreshed?.aliases).toEqual(seed.aliases);
    expect(refreshed?.altServings).toEqual(seed.altServings);
    expect(refreshed?.notes).toBe(seed.notes);
    expect(refreshed?.source).toBe('seed-estimate');
    expect((await database.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('skips edited rows (source "user") on upgrade', async () => {
    await seedDatabase(database);
    const seed = seedFoods.find((food) => food.id === 'seed-pork-adobo');
    expect(seed).toBeDefined();
    if (!seed) return;

    await database.foods.update(seed.id, {
      kcal: 999,
      source: 'user',
      name: 'My Adobo',
      notes: 'family recipe',
    });
    await database.meta.put({ key: 'seedVersion', value: 1 });

    await seedDatabase(database);

    const stored = await database.foods.get(seed.id);
    expect(stored?.kcal).toBe(999);
    expect(stored?.name).toBe('My Adobo');
    expect(stored?.notes).toBe('family recipe');
    expect(stored?.source).toBe('user');
  });

  it('preserves hidden through an upgrade and still refreshes the values', async () => {
    await seedDatabase(database);
    const seed = seedFoods.find((food) => food.id === 'seed-menudo');
    expect(seed).toBeDefined();
    if (!seed) return;

    await database.foods.update(seed.id, { hidden: true, kcal: 1 });
    await database.meta.put({ key: 'seedVersion', value: 1 });

    await seedDatabase(database);

    const stored = await database.foods.get(seed.id);
    expect(stored?.hidden).toBe(true);
    expect(stored?.kcal).toBe(seed.kcal);
  });

  it('hiding and unhiding a food does not change its source', async () => {
    await seedDatabase(database);
    const seed = seedFoods[0];
    expect(seed).toBeDefined();
    if (!seed) return;

    await setFoodHidden(seed.id, true, database);
    expect((await database.foods.get(seed.id))?.source).toBe('seed-estimate');

    await setFoodHidden(seed.id, false, database);
    expect((await database.foods.get(seed.id))?.source).toBe('seed-estimate');

    await database.meta.put({ key: 'seedVersion', value: 1 });
    await seedDatabase(database);
    const afterUpgrade = await database.foods.get(seed.id);
    expect(afterUpgrade?.source).toBe('seed-estimate');
    expect(afterUpgrade?.hidden).toBe(false);
  });

  it('keeps hidden seed foods hidden and still stored', async () => {
    await seedDatabase(database);
    const countBefore = await database.foods.count();
    await database.foods.update(firstSeedFood.id, { hidden: true });

    await seedDatabase(database);

    const stored = await database.foods.get(firstSeedFood.id);
    expect(stored).toBeDefined();
    expect(stored?.hidden).toBe(true);
    expect(await database.foods.count()).toBe(countBefore);
  });

  it('creates the profile once and preserves later edits', async () => {
    await seedDatabase(database);
    const created = await database.profile.get('me');
    expect(created).toEqual(DEFAULT_PROFILE);

    await database.profile.update('me', { kcalTarget: 2400, goalType: 'lose' });
    await seedDatabase(database);

    const stored = await database.profile.get('me');
    expect(stored?.kcalTarget).toBe(2400);
    expect(stored?.goalType).toBe('lose');
    expect(await database.profile.count()).toBe(1);
  });
});

describe('seed library size', () => {
  it('ships at least 150 Filipino foods', () => {
    expect(seedFoods.length).toBeGreaterThanOrEqual(150);
  });
});
