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

/** Percentage of a target, clamped to 0-100 for progress bars. */
export function targetPercent(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.max((consumed / target) * 100, 0), 100);
}
