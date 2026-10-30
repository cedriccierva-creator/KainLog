import { createLogEntry, roundServings } from '../lib/nutrition';
import type {
  CustomMeal,
  CustomMealItem,
  Food,
  FoodCategory,
  LogEntry,
  Meal,
} from '../types';
import { db, type KainLogDB } from './db';

export interface LogTarget {
  date: string;
  meal: Meal;
}

/** Write one snapshot entry for a food. */
export async function logFood(
  food: Food,
  target: LogTarget,
  servings: number,
  database: KainLogDB = db,
): Promise<LogEntry> {
  const entry = createLogEntry(food, { date: target.date, meal: target.meal, servings });
  await database.logEntries.add(entry);
  return entry;
}

export async function updateEntryServings(
  entryId: string,
  servings: number,
  database: KainLogDB = db,
): Promise<void> {
  await database.logEntries.update(entryId, { servings: roundServings(servings) });
}

export async function deleteEntry(entryId: string, database: KainLogDB = db): Promise<void> {
  await database.logEntries.delete(entryId);
}

/**
 * Expand a custom meal into one snapshot entry per item (e.g. Tapsilog becomes
 * tapa + sinangag + itlog). Items whose food no longer exists are skipped.
 */
export async function logCustomMeal(
  meal: CustomMeal,
  target: LogTarget,
  database: KainLogDB = db,
): Promise<number> {
  const foods = await database.foods.bulkGet(meal.items.map((item) => item.foodId));

  const entries: LogEntry[] = [];
  meal.items.forEach((item, index) => {
    const food = foods[index];
    if (!food) return;
    entries.push(
      createLogEntry(food, { date: target.date, meal: target.meal, servings: item.servings }),
    );
  });

  if (entries.length > 0) {
    await database.logEntries.bulkAdd(entries);
  }
  return entries.length;
}

export interface FoodInput {
  name: string;
  aliases: string[];
  category: FoodCategory;
  servingLabel: string;
  servingGrams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sodiumMg?: number;
  notes?: string;
}

/** Create a user food. User foods are never marked estimated or verified. */
export async function createFood(input: FoodInput, database: KainLogDB = db): Promise<Food> {
  const food: Food = {
    ...input,
    id: crypto.randomUUID(),
    altServings: [],
    isFilipino: true,
    source: 'user',
    verified: false,
  };
  await database.foods.add(food);
  return food;
}

/**
 * Update a food. Any edit makes the values the user's own, so the badge flips
 * from "estimate" to "custom". Past entries are untouched: they hold snapshots.
 */
export async function updateFood(
  foodId: string,
  input: FoodInput,
  database: KainLogDB = db,
): Promise<void> {
  await database.foods.update(foodId, { ...input, source: 'user', verified: false });
}

export async function setFoodHidden(
  foodId: string,
  hidden: boolean,
  database: KainLogDB = db,
): Promise<void> {
  await database.foods.update(foodId, { hidden });
}

export interface CustomMealInput {
  name: string;
  items: CustomMealItem[];
}

export async function createCustomMeal(
  input: CustomMealInput,
  database: KainLogDB = db,
): Promise<CustomMeal> {
  const meal: CustomMeal = { id: crypto.randomUUID(), name: input.name, items: input.items };
  await database.customMeals.add(meal);
  return meal;
}

export async function updateCustomMeal(
  mealId: string,
  input: CustomMealInput,
  database: KainLogDB = db,
): Promise<void> {
  await database.customMeals.update(mealId, { name: input.name, items: input.items });
}
