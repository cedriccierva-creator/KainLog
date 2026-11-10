import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KainLogDB } from '../db/db';
import { createFood, updateFood, type FoodInput } from '../db/logActions';
import { seedDatabase } from '../db/seed';

let database: KainLogDB;
let run = 0;

beforeEach(async () => {
  run += 1;
  database = new KainLogDB(`kainlog-test-food-defaults-${run}`);
  await seedDatabase(database);
});

afterEach(async () => {
  await database.delete();
});

const input: FoodInput = {
  name: 'My rice',
  aliases: [],
  category: 'rice',
  servingLabel: '100 g',
  servingGrams: 100,
  kcal: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
};

describe('isFilipino defaults', () => {
  it('creates a user food as not Filipino unless asked otherwise', async () => {
    const plain = await createFood(input, database);
    expect(plain.isFilipino).toBe(false);

    const flagged = await createFood({ ...input, isFilipino: true }, database);
    expect(flagged.isFilipino).toBe(true);
  });

  it('never flips the flag on an existing row when it is edited', async () => {
    const seedFood = await database.foods.get('seed-pork-adobo');
    expect(seedFood?.isFilipino).toBe(true);
    if (!seedFood) return;

    await updateFood(seedFood.id, { ...input, name: seedFood.name }, database);
    expect((await database.foods.get(seedFood.id))?.isFilipino).toBe(true);

    const userFood = await createFood(input, database);
    await updateFood(userFood.id, { ...input, name: 'Still mine' }, database);
    expect((await database.foods.get(userFood.id))?.isFilipino).toBe(false);
  });
});
