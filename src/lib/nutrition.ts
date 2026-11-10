import type { AmountMode, Food, FoodSnapshot, LogEntry, Meal } from '../types';
import { newId } from './id';

/** Atwater factors used by the food validator and the calorie math tests. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Servings move in quarter steps (0.25, 0.5, 0.75, 1, ...). */
export const SERVING_STEP = 0.25;

/** A single logged amount may not exceed this many grams. */
export const MAX_GRAMS = 10_000;

/** No honest log entry needs more servings than this; it also bounds bad input. */
export const MAX_SERVINGS = 10_000;

/** Nutrition numbers without the food identity attached. */
export interface NutritionValues {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

export const ZERO_NUTRITION: NutritionValues = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sodiumMg: 0,
};

/** Energy implied by the macro grams (4/4/9). */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(
    KCAL_PER_GRAM.protein * proteinG + KCAL_PER_GRAM.carbs * carbsG + KCAL_PER_GRAM.fat * fatG,
  );
}

/** Snap an arbitrary number to the nearest quarter serving, minimum one step. */
export function roundServings(servings: number): number {
  return Math.max(SERVING_STEP, Math.round(servings / SERVING_STEP) * SERVING_STEP);
}

/**
 * One stepper press. Snapping happens here and only here: a grams-derived
 * entry saved without touching the stepper keeps its exact servings.
 */
export function stepServings(servings: number, direction: 1 | -1): number {
  return roundServings(servings + direction * SERVING_STEP);
}

/** A servings value must be finite, positive and within MAX_SERVINGS. */
export function isValidServings(servings: number): boolean {
  return Number.isFinite(servings) && servings > 0 && servings <= MAX_SERVINGS;
}

/** Guard used before writing a log entry; bad input must never reach IndexedDB. */
export function assertValidServings(servings: number): void {
  if (!isValidServings(servings)) {
    throw new RangeError(
      `Servings must be a finite number above 0 and at most ${MAX_SERVINGS} (got ${String(servings)}).`,
    );
  }
}

/** Grams for a serving count. Full precision; display rounds. */
export function gramsFromServings(servings: number, servingGrams: number): number {
  return servings * servingGrams;
}

/** Exact servings for a gram amount. Never snapped to a quarter step. */
export function servingsFromGrams(grams: number, servingGrams: number): number {
  return servingGrams > 0 ? grams / servingGrams : 0;
}

/**
 * Parse the grams input. Returns null when the text is blank, non-numeric, zero,
 * negative or above MAX_GRAMS, so the UI can disable its save button.
 */
export function parseGramAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const grams = Number(trimmed);
  if (!Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) return null;
  return grams;
}

/** "100 g" (a bare gram amount) is the label that makes Grams the default input. */
export function isGramServingLabel(label: string): boolean {
  return /^\s*\d+(?:\.\d+)?\s*g\s*$/i.test(label);
}

/** Freeze a food's per-serving values + labels into a LogEntry snapshot. */
export function snapshotFromFood(food: Food): FoodSnapshot {
  return {
    foodName: food.name,
    servingLabel: food.servingLabel,
    servingGrams: food.servingGrams,
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG ?? 0,
    sodiumMg: food.sodiumMg ?? 0,
  };
}

/**
 * Multiply per-serving (or already-scaled) values by a serving count.
 * The result keeps full precision: rounding happens only when displaying.
 */
export function scaleNutrition(base: NutritionValues, servings: number): NutritionValues {
  return {
    kcal: base.kcal * servings,
    proteinG: base.proteinG * servings,
    carbsG: base.carbsG * servings,
    fatG: base.fatG * servings,
    fiberG: base.fiberG * servings,
    sodiumMg: base.sodiumMg * servings,
  };
}

/** Totals for one logged entry: snapshot × servings, never the live Food row. */
export function entryNutrition(entry: LogEntry): NutritionValues {
  return scaleNutrition(entry.snapshot, entry.servings);
}

export function sumNutrition(items: readonly NutritionValues[]): NutritionValues {
  // No rounding here either: four 0.25-serving entries must add up to exactly one serving.
  return items.reduce<NutritionValues>(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      proteinG: acc.proteinG + item.proteinG,
      carbsG: acc.carbsG + item.carbsG,
      fatG: acc.fatG + item.fatG,
      fiberG: acc.fiberG + item.fiberG,
      sodiumMg: acc.sodiumMg + item.sodiumMg,
    }),
    { ...ZERO_NUTRITION },
  );
}

export interface CreateLogEntryInput {
  date: string;
  meal: Meal;
  servings: number;
  /** Defaults to "servings" so older callers keep their meaning. */
  amountMode?: AmountMode;
  now?: number;
}

/**
 * Build a LogEntry from a food. The snapshot is taken here and never refreshed,
 * so later edits to the food cannot change this entry's totals.
 */
export function createLogEntry(food: Food, input: CreateLogEntryInput): LogEntry {
  assertValidServings(input.servings);

  return {
    id: newId(),
    date: input.date,
    meal: input.meal,
    foodId: food.id,
    // Exact, not snapped: grams logging produces values like 1.67 servings.
    servings: input.servings,
    amountMode: input.amountMode ?? 'servings',
    snapshot: snapshotFromFood(food),
    createdAt: input.now ?? Date.now(),
  };
}
