import { localDateKey } from './date';
import { entryNutrition, sumNutrition } from './nutrition';
import type { LogEntry } from '../types';

export interface DayCalories {
  date: string;
  /** null means "no data" — nothing logged that day, so it is not a zero. */
  kcal: number | null;
}

export interface WeekSummary {
  days: DayCalories[];
  /** Mean over days that have entries only. */
  averageKcal: number | null;
  daysWithData: number;
  daysWithoutData: number;
}

export function summarizeDays(
  dates: readonly string[],
  entries: readonly LogEntry[],
): WeekSummary {
  const byDate = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const dayEntries = byDate.get(entry.date);
    if (dayEntries) {
      dayEntries.push(entry);
    } else {
      byDate.set(entry.date, [entry]);
    }
  }

  const days: DayCalories[] = dates.map((date) => {
    const dayEntries = byDate.get(date) ?? [];
    return {
      date,
      kcal: dayEntries.length === 0 ? null : sumNutrition(dayEntries.map(entryNutrition)).kcal,
    };
  });

  const withData = days.filter((day): day is { date: string; kcal: number } => day.kcal !== null);
  const total = withData.reduce((sum, day) => sum + day.kcal, 0);

  return {
    days,
    averageKcal: withData.length === 0 ? null : total / withData.length,
    daysWithData: withData.length,
    daysWithoutData: days.length - withData.length,
  };
}

export interface WeightPoint {
  date: string;
  kg: number;
  /** Trailing 7-day mean ending on this date (calendar days, not entry count). */
  movingAverage: number;
}

export function movingAverage(
  entries: readonly { date: string; kg: number }[],
  windowDays = 7,
): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((point) => {
    const start = addDaysToKey(point.date, -(windowDays - 1));
    const window = sorted.filter((entry) => entry.date >= start && entry.date <= point.date);
    const mean = window.reduce((sum, entry) => sum + entry.kg, 0) / window.length;
    return { ...point, movingAverage: Math.round(mean * 100) / 100 };
  });
}

function addDaysToKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + days, 12, 0, 0);
  return localDateKey(shifted);
}

/** Signed change between the first and last weigh-in, or null with <2 entries. */
export function weightChange(points: readonly { kg: number }[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].kg - points[0].kg;
}
