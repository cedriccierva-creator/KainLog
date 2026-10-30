import seedFoodData from '../data/foods.ph.json';
import type { Food, MetaRecord, Profile } from '../types';
import { db, type KainLogDB } from './db';

/**
 * Bump when foods.ph.json changes. On startup an existing install whose stored
 * version is lower gets its *unedited* seed rows refreshed (see seedDatabase).
 * Version 2 shipped alt servings; 3 introduces this refresh policy.
 */
export const SEED_VERSION = 3;

/** meta key: true while the user has not set real goals (the Profile form clears it). */
export const META_PROFILE_PLACEHOLDER = 'profileIsPlaceholder';

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
 * A seed row owns everything except identity, provenance, verification and the
 * user's hidden flag. Refreshing uses the current JSON but keeps `hidden`.
 */
function refreshSeedRow(seed: Food, existing: Food): Food {
  return existing.hidden === undefined ? { ...seed } : { ...seed, hidden: existing.hidden };
}

/**
 * Insert missing seed foods, upgrade stale seed-owned data, and create the
 * profile once.
 *
 * Rules:
 * - never delete a food;
 * - insert ids that are missing;
 * - on a version bump, refresh ONLY rows still marked `seed-estimate` — rows the
 *   user edited (`source: "user"`) are never touched;
 * - the `hidden` flag always survives;
 * - user edits, custom foods and past log snapshots are untouched.
 */
export async function seedDatabase(database: KainLogDB = db): Promise<void> {
  await database.transaction('rw', database.foods, database.profile, database.meta, async () => {
    const storedMeta = await database.meta.get('seedVersion');
    const storedVersion = typeof storedMeta?.value === 'number' ? storedMeta.value : 0;

    const existingRows = await database.foods.bulkGet(seedFoods.map((food) => food.id));

    const missing = seedFoods.filter((_, index) => existingRows[index] === undefined);
    if (missing.length > 0) {
      await database.foods.bulkAdd(missing);
    }

    // Only upgrade installs that already had a seed version; a fresh install was
    // just written from the current JSON.
    if (storedVersion > 0 && storedVersion < SEED_VERSION) {
      const refreshed: Food[] = [];
      seedFoods.forEach((seed, index) => {
        const existing = existingRows[index];
        if (!existing) return;
        if (existing.source !== 'seed-estimate') return;
        refreshed.push(refreshSeedRow(seed, existing));
      });
      if (refreshed.length > 0) {
        await database.foods.bulkPut(refreshed);
      }
    }

    const profile = await database.profile.get('me');
    if (!profile) {
      await database.profile.add(DEFAULT_PROFILE);
      await database.meta.put({ key: META_PROFILE_PLACEHOLDER, value: true });
    }

    const meta: MetaRecord = { key: 'seedVersion', value: SEED_VERSION };
    await database.meta.put(meta);
  });
}
