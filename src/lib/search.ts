import type { Food, FoodCategory } from '../types';

/**
 * Case- and diacritic-insensitive form used for matching.
 * NFD splits accented letters, then the combining marks are dropped ("bisték" -> "bistek").
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match strength of one search term against the query.
 * 0 = exact, 1 = starts with, 2 = a word starts with, 3 = appears inside.
 */
function matchRank(term: string, query: string): number | null {
  if (term === query) return 0;
  if (term.startsWith(query)) return 1;
  if (term.split(' ').some((word) => word.startsWith(query))) return 2;
  if (term.includes(query)) return 3;
  return null;
}

/**
 * Lower score = better. A name match always beats an alias match at the same
 * strength, so "adobo" surfaces "Pork Adobo" ahead of a food that only mentions
 * adobo in an alias.
 */
export function scoreFood(food: Food, normalizedQuery: string): number | null {
  if (!normalizedQuery) return 0;

  let best: number | null = null;
  const nameRank = matchRank(normalize(food.name), normalizedQuery);
  if (nameRank !== null) best = nameRank * 10;

  for (const alias of food.aliases) {
    const aliasRank = matchRank(normalize(alias), normalizedQuery);
    if (aliasRank === null) continue;
    const aliasScore = aliasRank * 10 + 5;
    if (best === null || aliasScore < best) best = aliasScore;
  }

  return best;
}

export interface SearchOptions {
  category?: FoodCategory | 'all';
  limit?: number;
  /** Hidden foods are excluded from pickers by default but still resolvable in history. */
  includeHidden?: boolean;
}

function compareFoods(a: Food, b: Food): number {
  const byLength = a.name.length - b.name.length;
  if (byLength !== 0) return byLength;
  return a.name.localeCompare(b.name);
}

/** Rank foods for a query: prefix matches before substring matches, then by name. */
export function searchFoods(
  foods: readonly Food[],
  query: string,
  options: SearchOptions = {},
): Food[] {
  const { category = 'all', limit = 50, includeHidden = false } = options;
  const normalizedQuery = normalize(query);

  const pool = foods.filter(
    (food) =>
      (includeHidden || !food.hidden) && (category === 'all' || food.category === category),
  );

  if (!normalizedQuery) {
    return [...pool].sort(compareFoods).slice(0, limit);
  }

  return pool
    .map((food) => ({ food, score: scoreFood(food, normalizedQuery) }))
    .filter((match): match is { food: Food; score: number } => match.score !== null)
    .sort((a, b) => a.score - b.score || compareFoods(a.food, b.food))
    .slice(0, limit)
    .map((match) => match.food);
}
