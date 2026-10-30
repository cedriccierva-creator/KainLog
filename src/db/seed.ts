import seedFoodData from '../data/foods.ph.json';
import type { Food, MetaRecord, Profile } from '../types';
import { db, type KainLogDB } from './db';

/** Bump when foods.ph.json changes; new seed ids are then filled in on next launch. */
export const SEED_VERSION = 1;

/**
 * The JSON is checked by `npm run validate:foods`; the cast narrows the widened
 * string types TS infers from JSON imports (e.g. category: string).
 */
export const seedFoods = seedFoodData as Food[];

/** Placeholder so the Diary can render before the user enters their stats. */
export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  sex: 'male',
  age: 25,
  heightCm: 170,
  weightKg: 65,
  activityLevel: 'moderate',
  goalType: 'maintain',
  kcalTarget: 2000,
  proteinG: 100,
  carbsG: 250,
  fatG: 60,
};

/**
 * Insert-only seeding: adds seed foods whose ids are missing and creates the
 * profile once. Rows that already exist are never touched, so user edits,
 * custom values and hidden flags survive every launch and every seed version bump.
 */
export async function seedDatabase(database: KainLogDB = db): Promise<void> {
  await database.transaction('rw', database.foods, database.profile, database.meta, async () => {
    const existing = await database.foods.bulkGet(seedFoods.map((food) => food.id));
    const missing = seedFoods.filter((_, index) => existing[index] === undefined);
    if (missing.length > 0) {
      await database.foods.bulkAdd(missing);
    }

    const profile = await database.profile.get('me');
    if (!profile) {
      await database.profile.add(DEFAULT_PROFILE);
    }

    const meta: MetaRecord = { key: 'seedVersion', value: SEED_VERSION };
    await database.meta.put(meta);
  });
}
