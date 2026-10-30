import type { Meal } from '../types';

export const MEAL_ORDER: readonly Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export function isMeal(value: string | null): value is Meal {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack';
}
