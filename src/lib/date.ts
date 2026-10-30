/**
 * All day boundaries in KainLog use the device's local calendar day.
 * `toISOString()` is banned by ESLint outside the backup timestamp for exactly
 * this reason: it converts to UTC first and can move a meal to the wrong day.
 */

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Local calendar day key ("YYYY-MM-DD") for an instant. */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's key on this device. */
export function todayKey(): string {
  return localDateKey();
}

/**
 * Parse a day key back into a local Date at 12:00.
 * Noon (instead of midnight) keeps arithmetic safe across DST transitions.
 */
export function dateKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Shift a day key by whole days, handling month/year/DST boundaries. */
export function addDays(key: string, delta: number): string {
  const date = dateKeyToDate(key);
  date.setDate(date.getDate() + delta);
  return localDateKey(date);
}

export function isToday(key: string): boolean {
  return key === localDateKey();
}

/** The last `count` day keys ending at `endKey`, oldest first. */
export function lastNDays(endKey: string, count: number): string[] {
  const days: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDays(endKey, -offset));
  }
  return days;
}

/** Short human label, e.g. "Fri, Oct 31". */
export function formatDayLabel(key: string, locale = 'en-PH'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dateKeyToDate(key));
}
