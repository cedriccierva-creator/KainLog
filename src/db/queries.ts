import { entryNutrition, sumNutrition, type NutritionValues } from '../lib/nutrition';
import type { Food, LogEntry, Meal } from '../types';
import { db, type KainLogDB } from './db';

/** Entries for one local day, oldest first (stable order inside each meal). */
export async function getDayEntries(date: string, database: KainLogDB = db): Promise<LogEntry[]> {
  const entries = await database.logEntries.where('date').equals(date).toArray();
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getDayTotals(date: string, database: KainLogDB = db): Promise<NutritionValues> {
  const entries = await getDayEntries(date, database);
  return sumNutrition(entries.map(entryNutrition));
}

export interface RecentFood {
  food: Food;
  /** Servings used last time, so re-logging is one tap. */
  servings: number;
  meal: Meal;
  date: string;
}

/**
 * Distinct foods ordered by most recent log. Hidden and deleted foods are
 * skipped, because those cannot be offered as a quick re-log.
 */
export async function getRecentFoods(limit = 8, database: KainLogDB = db): Promise<RecentFood[]> {
  const entries = await database.logEntries.toArray();
  const newestFirst = [...entries].sort((a, b) => b.createdAt - a.createdAt);

  const latestPerFood: LogEntry[] = [];
  const seen = new Set<string>();
  for (const entry of newestFirst) {
    if (seen.has(entry.foodId)) continue;
    seen.add(entry.foodId);
    latestPerFood.push(entry);
  }

  const foods = await database.foods.bulkGet(latestPerFood.map((entry) => entry.foodId));
  const recent: RecentFood[] = [];
  latestPerFood.forEach((entry, index) => {
    const food = foods[index];
    if (!food || food.hidden) return;
    recent.push({ food, servings: entry.servings, meal: entry.meal, date: entry.date });
  });

  return recent.slice(0, limit);
}

export interface FrequentFood {
  food: Food;
  count: number;
  servings: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Foods logged most often in the last `days` days, hidden foods excluded. */
export async function getFrequentFoods(
  limit = 6,
  days = 30,
  database: KainLogDB = db,
): Promise<FrequentFood[]> {
  const cutoff = Date.now() - days * DAY_MS;
  const entries = (await database.logEntries.toArray()).filter((entry) => entry.createdAt >= cutoff);

  const stats = new Map<string, { count: number; servings: number; last: number }>();
  for (const entry of entries) {
    const current = stats.get(entry.foodId);
    if (current) {
      current.count += 1;
      if (entry.createdAt >= current.last) {
        current.last = entry.createdAt;
        current.servings = entry.servings;
      }
    } else {
      stats.set(entry.foodId, {
        count: 1,
        servings: entry.servings,
        last: entry.createdAt,
      });
    }
  }

  const ranked = [...stats.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].last - a[1].last,
  );
  const foods = await database.foods.bulkGet(ranked.map(([foodId]) => foodId));

  const frequent: FrequentFood[] = [];
  ranked.forEach(([, value], index) => {
    const food = foods[index];
    if (!food || food.hidden) return;
    frequent.push({ food, count: value.count, servings: value.servings });
  });

  return frequent.slice(0, limit);
}

/** Look up many foods by id, keeping the requested order and dropping missing rows. */
export async function getFoodsByIds(ids: string[], database: KainLogDB = db): Promise<Food[]> {
  const foods = await database.foods.bulkGet(ids);
  return foods.filter((food): food is Food => food !== undefined);
}
