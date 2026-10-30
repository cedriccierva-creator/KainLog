import { PROFILE_LIMITS } from './tdee';

/** Parse a text input into a finite number, or null when empty/invalid. */
export function parseNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Weight-log entries must be a plausible adult weight in kg. */
export function isValidWeightKg(value: string): boolean {
  const kg = parseNumberInput(value);
  return kg !== null && kg >= PROFILE_LIMITS.weightKg.min && kg <= PROFILE_LIMITS.weightKg.max;
}
