import { gramsFromServings } from './nutrition';
import type { LogEntry } from '../types';

/**
 * Display formatting only. Stored and logged nutrition keeps full precision;
 * these helpers round for the screen (and are the only place that rounds).
 */

export function formatKcal(value: number): string {
  return String(Math.round(value));
}

export function formatGrams(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatServings(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Amount label for a diary row. Entries logged in grams show their total grams
 * ("167 g"); every other entry keeps the "1.25 × 1 cup" form. Rounding happens
 * here, so 1.67 × 100 never leaks 167.00000000000003 onto the screen.
 */
export function formatEntryAmount(entry: LogEntry): string {
  const servingGrams = entry.snapshot.servingGrams;
  if (entry.amountMode === 'grams' && servingGrams !== undefined) {
    return `${formatGrams(gramsFromServings(entry.servings, servingGrams))} g`;
  }
  return `${formatServings(entry.servings)} × ${entry.snapshot.servingLabel}`;
}

/** Percentage of a target, clamped to 0-100 for progress bars. */
export function targetPercent(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.max((consumed / target) * 100, 0), 100);
}
