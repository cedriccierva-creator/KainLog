import { assertValidServings, createLogEntry } from '../lib/nutrition';
import type {
  AmountMode,
  CustomMeal,
  CustomMealItem,
  Food,
  FoodCategory,
  LogEntry,
  Meal,
} from '../types';
import { db, type KainLogDB } from './db';
import { newId } from '../lib/id';

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
  amountMode: AmountMode = 'servings',
): Promise<LogEntry> {
  const entry = createLogEntry(food, {
    date: target.date,
    meal: target.meal,
    servings,
    amountMode,
  });
  await database.logEntries.add(entry);
  return entry;
}

/**
 * Save an edited amount. Servings are stored exactly as given: a grams entry
 * opened and saved untouched must keep e.g. 1.67, not snap to 1.75.
 * Pass amountMode only when the user actually changed the input mode/amount.
 * Invalid values throw before anything is written.
 */
export async function updateEntryServings(
  entryId: string,
  servings: number,
  database: KainLogDB = db,
  amountMode?: AmountMode,
): Promise<void> {
  assertValidServings(servings);
  await database.logEntries.update(entryId, amountMode ? { servings, amountMode } : { servings });
}

export async function deleteEntry(entryId: string, database: KainLogDB = db): Promise<void> {
  await database.logEntries.delete(entryId);
}

export interface CustomMealLogResult {
  written: number;
  skipped: number;
}

/**
 * Expand a custom meal into one snapshot entry per item (e.g. Tapsilog becomes
 * tapa + sinangag + itlog). Items whose food no longer exists are skipped and
 * reported back so the UI can say how many were dropped.
 */
export async function logCustomMeal(
  meal: CustomMeal,
  target: LogTarget,
  database: KainLogDB = db,
): Promise<CustomMealLogResult> {
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
  return { written: entries.length, skipped: meal.items.length - entries.length };
}

export interface FoodInput {
  name: string;
  aliases: string[];
  category: FoodCategory;
  servingLabel: string;
  servingGrams: number;
  /** Optional so imports and per-100 g entry can say so; defaults to false. */
  isFilipino?: boolean;
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
    id: newId(),
    altServings: [],
    isFilipino: input.isFilipino ?? false,
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
  const meal: CustomMeal = { id: newId(), name: input.name, items: input.items };
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
