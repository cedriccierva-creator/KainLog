/** Shared types for the whole app. Keep this file the single source of truth for stored shapes. */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const FOOD_CATEGORIES = [
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
  /** Fallback for imported foods whose category is unknown or missing. */
  'other',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/** Seed foods are estimates; anything the user typed in is "user". */
export type FoodSource = 'seed-estimate' | 'user';

export interface AltServing {
  label: string;
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  /** Tagalog / English / alternate spellings. Searchable. */
  aliases: string[];
  category: FoodCategory;
  servingLabel: string;
  servingGrams: number;
  altServings: AltServing[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sodiumMg?: number;
  isFilipino: boolean;
  source: FoodSource;
  verified: boolean;
  notes?: string;
  /**
   * Hidden foods stay in the database (past LogEntries reference their id) but are
   * not offered when adding new food. Seeding never deletes or un-hides anything.
   */
  hidden?: boolean;
}

/**
 * Nutrition for exactly ONE serving, frozen at logging time.
 * Totals are always derived from this copy, never from the live Food row.
 */
export interface FoodSnapshot {
  foodName: string;
  servingLabel: string;
  /**
   * Grams per serving at logging time. Absent on entries logged before grams
   * support existed: those stay servings-only, and their grams are never guessed.
   */
  servingGrams?: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

/** How the amount was entered; older entries have no value (servings). */
export type AmountMode = 'servings' | 'grams';

export interface LogEntry {
  id: string;
  /** Local calendar day as "YYYY-MM-DD". Never derived from UTC. */
  date: string;
  meal: Meal;
  foodId: string;
  /** Grams-derived servings keep full precision; the stepper snaps to 0.25. */
  servings: number;
  amountMode?: AmountMode;
  snapshot: FoodSnapshot;
  createdAt: number;
}

export interface CustomMealItem {
  foodId: string;
  servings: number;
}

export interface CustomMeal {
  id: string;
  name: string;
  items: CustomMealItem[];
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type GoalType = 'lose' | 'maintain' | 'gain';

/** Single-user app: exactly one row with id "me". */
export interface Profile {
  id: 'me';
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  kcalTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

/** Small key/value store for flags such as seedVersion and theme. */
export interface MetaRecord {
  key: string;
  value: string | number | boolean;
}
