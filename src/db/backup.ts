import type { CustomMeal, Food, LogEntry, MetaRecord, Profile, WeightEntry } from '../types';
import { db } from './db';
import { SEED_VERSION, seedDatabase } from './seed';
import { applyStoredTheme } from '../lib/theme';

/** Bump only when the exported shape changes. Importers refuse other versions. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupTables {
  foods: Food[];
  logEntries: LogEntry[];
  customMeals: CustomMeal[];
  weightEntries: WeightEntry[];
  profile: Profile[];
  meta: MetaRecord[];
}

export interface BackupFile {
  app: 'kainlog';
  schemaVersion: number;
  seedVersion: number;
  exportedAt: string;
  tables: BackupTables;
}

export async function buildBackup(): Promise<BackupFile> {
  return {
    app: 'kainlog',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    // eslint-disable-next-line no-restricted-properties -- the one allowed UTC use
    exportedAt: new Date().toISOString(),
    tables: {
      foods: await db.foods.toArray(),
      logEntries: await db.logEntries.toArray(),
      customMeals: await db.customMeals.toArray(),
      weightEntries: await db.weightEntries.toArray(),
      profile: await db.profile.toArray(),
      meta: await db.meta.toArray(),
    },
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/*                                                                     */
/* Hand-written, no schema library. Everything is checked BEFORE the   */
/* database is touched, so a bad file can never wipe real data.        */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORIES = [
  'ulam',
  'fish-seafood',
  'vegetables',
  'silog-breakfast',
  'rice',
  'noodles',
  'street-food',
  'merienda-desserts',
  'drinks',
  'fruits',
  'fast-food',
];
const SOURCES = ['seed-estimate', 'user'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];
const GOAL_TYPES = ['lose', 'maintain', 'gain'];
const SEXES = ['male', 'female'];

function isOneOf(value: unknown, allowed: readonly string[]): boolean {
  return isString(value) && allowed.includes(value);
}

function isOptional(value: unknown, check: (inner: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function isAltServing(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.label) && isFiniteNumber(value.grams);
}

function isFood(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const altServings = value.altServings;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    Array.isArray(value.aliases) &&
    value.aliases.every(isString) &&
    isOneOf(value.category, CATEGORIES) &&
    isNonEmptyString(value.servingLabel) &&
    isFiniteNumber(value.servingGrams) &&
    Array.isArray(altServings) &&
    altServings.every(isAltServing) &&
    isFiniteNumber(value.kcal) &&
    isFiniteNumber(value.proteinG) &&
    isFiniteNumber(value.carbsG) &&
    isFiniteNumber(value.fatG) &&
    isOptional(value.fiberG, isFiniteNumber) &&
    isOptional(value.sodiumMg, isFiniteNumber) &&
    typeof value.isFilipino === 'boolean' &&
    isOneOf(value.source, SOURCES) &&
    typeof value.verified === 'boolean' &&
    isOptional(value.notes, isString) &&
    isOptional(value.hidden, (hidden) => typeof hidden === 'boolean')
  );
}

function isSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.foodName) &&
    isNonEmptyString(value.servingLabel) &&
    isFiniteNumber(value.kcal) &&
    isFiniteNumber(value.proteinG) &&
    isFiniteNumber(value.carbsG) &&
    isFiniteNumber(value.fatG) &&
    isFiniteNumber(value.fiberG) &&
    isFiniteNumber(value.sodiumMg)
  );
}

function isLogEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isIsoDate(value.date) &&
    isOneOf(value.meal, MEALS) &&
    isNonEmptyString(value.foodId) &&
    isFiniteNumber(value.servings) &&
    value.servings > 0 &&
    isSnapshot(value.snapshot) &&
    isFiniteNumber(value.createdAt)
  );
}

function isCustomMeal(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const items = value.items;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (item: unknown) =>
        isRecord(item) && isNonEmptyString(item.foodId) && isFiniteNumber(item.servings),
    )
  );
}

function isWeightEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    isIsoDate(value.date) &&
    isFiniteNumber(value.kg) &&
    value.kg > 0 &&
    value.kg < 1000
  );
}

function isProfile(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.id === 'me' &&
    isOneOf(value.sex, SEXES) &&
    isFiniteNumber(value.age) &&
    isFiniteNumber(value.heightCm) &&
    isFiniteNumber(value.weightKg) &&
    isOneOf(value.activityLevel, ACTIVITY_LEVELS) &&
    isOneOf(value.goalType, GOAL_TYPES) &&
    isFiniteNumber(value.kcalTarget) &&
    isFiniteNumber(value.proteinG) &&
    isFiniteNumber(value.carbsG) &&
    isFiniteNumber(value.fatG)
  );
}

function isMeta(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.key) &&
    (isString(value.value) || isFiniteNumber(value.value) || typeof value.value === 'boolean')
  );
}

function hasUniqueIds(rows: readonly { id: string }[]): boolean {
  return new Set(rows.map((row) => row.id)).size === rows.length;
}

function checkRows(
  value: unknown,
  label: string,
  check: (row: unknown) => boolean,
): string | null {
  if (!Array.isArray(value)) return `Backup ${label} are missing.`;
  if (!value.every(check)) return `Backup ${label} contain malformed rows.`;
  return null;
}

export type ParseBackupResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'That file is not a KainLog backup.' };
  }
  if (parsed.app !== 'kainlog') {
    return { ok: false, error: 'That file is not a KainLog backup.' };
  }
  if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Backup version ${String(parsed.schemaVersion)} is not supported (this build reads version ${BACKUP_SCHEMA_VERSION}).`,
    };
  }
  if (!isFiniteNumber(parsed.seedVersion)) {
    return { ok: false, error: 'Backup is missing its seed version.' };
  }
  if (!isString(parsed.exportedAt)) {
    return { ok: false, error: 'Backup is missing its export timestamp.' };
  }
  if (!isRecord(parsed.tables)) {
    return { ok: false, error: 'Backup has no table data.' };
  }

  const tables = parsed.tables;
  const problems = [
    checkRows(tables.foods, 'foods', isFood),
    checkRows(tables.logEntries, 'log entries', isLogEntry),
    checkRows(tables.customMeals, 'custom meals', isCustomMeal),
    checkRows(tables.weightEntries, 'weight entries', isWeightEntry),
    checkRows(tables.profile, 'profile', isProfile),
    checkRows(tables.meta, 'settings', isMeta),
  ].filter((problem): problem is string => problem !== null);

  if (problems.length > 0) {
    return { ok: false, error: problems[0] };
  }

  const foods = tables.foods as Food[];
  const logEntries = tables.logEntries as LogEntry[];
  const customMeals = tables.customMeals as CustomMeal[];
  const weightEntries = tables.weightEntries as WeightEntry[];
  const profile = tables.profile as Profile[];
  const meta = tables.meta as MetaRecord[];

  if (profile.length !== 1) {
    return { ok: false, error: 'Backup must contain exactly one profile.' };
  }
  if (!hasUniqueIds(foods) || !hasUniqueIds(logEntries) || !hasUniqueIds(customMeals)) {
    return { ok: false, error: 'Backup contains duplicate ids.' };
  }

  return {
    ok: true,
    backup: {
      app: 'kainlog',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      seedVersion: parsed.seedVersion,
      exportedAt: parsed.exportedAt,
      tables: { foods, logEntries, customMeals, weightEntries, profile, meta },
    },
  };
}

/**
 * Replaces every table in one transaction, then re-seeds so foods added by a
 * newer app version reappear and seed rows keep the current refresh policy.
 */
export async function applyBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [db.foods, db.logEntries, db.customMeals, db.weightEntries, db.profile, db.meta],
    async () => {
      await db.foods.clear();
      await db.logEntries.clear();
      await db.customMeals.clear();
      await db.weightEntries.clear();
      await db.profile.clear();
      await db.meta.clear();

      await db.foods.bulkAdd(backup.tables.foods);
      await db.logEntries.bulkAdd(backup.tables.logEntries);
      await db.customMeals.bulkAdd(backup.tables.customMeals);
      await db.weightEntries.bulkAdd(backup.tables.weightEntries);
      await db.profile.bulkAdd(backup.tables.profile);
      await db.meta.bulkAdd(backup.tables.meta);
    },
  );

  await seedDatabase();

  // The imported meta may carry a different theme (or none). Apply it to the
  // document and the boot mirror so class, mirror and meta agree after import.
  await applyStoredTheme();
}
