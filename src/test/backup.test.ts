import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import {
  BACKUP_SCHEMA_VERSION,
  applyBackup,
  buildBackup,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from '../db/backup';
import { seedDatabase } from '../db/seed';
import { todayKey } from '../lib/date';
import { createLogEntry } from '../lib/nutrition';

async function freshDatabase(): Promise<void> {
  await db.delete();
  await db.open();
  await seedDatabase(db);
}

/** Shape held by the round-trip test: everything except the export timestamp. */
function withoutTimestamp(backup: BackupFile): Omit<BackupFile, 'exportedAt'> {
  return {
    app: backup.app,
    schemaVersion: backup.schemaVersion,
    seedVersion: backup.seedVersion,
    tables: backup.tables,
  };
}

beforeEach(async () => {
  await freshDatabase();
});

describe('backup round-trip', () => {
  it('restores exactly the same tables after the database is changed', async () => {
    const food = await db.foods.get('seed-pork-adobo');
    expect(food).toBeDefined();
    if (!food) return;

    await db.logEntries.add(
      createLogEntry(food, { date: todayKey(), meal: 'lunch', servings: 1.5 }),
    );
    await db.customMeals.add({
      id: 'meal-test',
      name: 'Adobo + rice',
      items: [
        { foodId: food.id, servings: 1 },
        { foodId: 'seed-rice-cooked', servings: 1 },
      ],
    });
    await db.weightEntries.put({ date: todayKey(), kg: 64.2 });
    await db.profile.put({
      id: 'me',
      sex: 'female',
      age: 31,
      heightCm: 162,
      weightKg: 64.2,
      activityLevel: 'light',
      goalType: 'lose',
      kcalTarget: 1650,
      proteinG: 103,
      carbsG: 180,
      fatG: 46,
    });
    await db.meta.put({ key: 'theme', value: 'dark' });

    const original = await buildBackup();

    // Wreck the live database in ways an import must undo.
    await db.foods.delete('seed-pork-adobo');
    await db.logEntries.clear();
    await db.customMeals.clear();
    await db.weightEntries.clear();
    await db.meta.put({ key: 'theme', value: 'light' });

    await applyBackup(original);

    const restored = await buildBackup();
    expect(withoutTimestamp(restored)).toEqual(withoutTimestamp(original));

    // And the restored row survived re-seeding, not just the bulk copy.
    expect(await db.foods.get('seed-pork-adobo')).toBeDefined();
    expect(await db.logEntries.count()).toBe(1);
    expect(await db.weightEntries.count()).toBe(1);
    expect((await db.profile.get('me'))?.kcalTarget).toBe(1650);
    expect((await db.meta.get('theme'))?.value).toBe('dark');
  });

  it('parses its own serialized output', async () => {
    const backup = await buildBackup();
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.seedVersion).toBe(backup.seedVersion);
    expect(result.backup.tables.logEntries).toEqual([]);
  });
});

describe('backup validation', () => {
  it('rejects a corrupted file without touching the database', async () => {
    const foodsBefore = await db.foods.count();
    const entriesBefore = await db.logEntries.count();

    const result = parseBackup('{"app":"kainlog", oops');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/);

    expect(await db.foods.count()).toBe(foodsBefore);
    expect(await db.logEntries.count()).toBe(entriesBefore);
  });

  it('rejects a wrong schema version', async () => {
    const backup = await buildBackup();
    const tampered = { ...backup, schemaVersion: BACKUP_SCHEMA_VERSION + 1 };

    const result = parseBackup(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not supported/);
    expect(await db.foods.count()).toBe(167);
  });

  it('rejects malformed rows before any write happens', async () => {
    const backup = await buildBackup();
    const tampered = {
      ...backup,
      tables: {
        ...backup.tables,
        foods: [{ ...backup.tables.foods[0], kcal: 'lots' }],
      },
    };

    const result = parseBackup(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/foods contain malformed rows/);
    expect(await db.foods.count()).toBe(167);
  });

  it('rejects duplicate ids', async () => {
    const backup = await buildBackup();
    const first = backup.tables.foods[0];
    const tampered = {
      ...backup,
      tables: { ...backup.tables, foods: [first, first] },
    };

    const result = parseBackup(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/duplicate ids/);
  });
});
