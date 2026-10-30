import { describe, expect, it } from 'vitest';
import { seedFoods } from '../db/seed';
import { normalize, searchFoods } from '../lib/search';
import type { Food } from '../types';

function makeFood(overrides: Partial<Food> & { id: string; name: string }): Food {
  return {
    aliases: [],
    category: 'ulam',
    servingLabel: '1 serving',
    servingGrams: 100,
    altServings: [],
    kcal: 100,
    proteinG: 5,
    carbsG: 10,
    fatG: 3,
    isFilipino: true,
    source: 'user',
    verified: false,
    ...overrides,
  };
}

const ids = (foods: Food[]): string[] => foods.map((food) => food.id);
const top = (query: string, limit = 3): string[] =>
  ids(searchFoods(seedFoods, query, { limit }));

describe('acceptance searches (top 3 must contain a relevant food)', () => {
  it('"adobo" finds adobo dishes', () => {
    const result = top('adobo');
    const relevant = [
      'seed-pork-adobo',
      'seed-chicken-adobo',
      'seed-adobong-pusit',
      'seed-adobong-kangkong',
    ];
    expect(result.some((id) => relevant.includes(id)), `top 3: ${result.join(', ')}`).toBe(true);
  });

  it('"sinigan" (misspelling) finds sinigang', () => {
    const result = top('sinigan');
    const relevant = ['seed-sinigang-na-baboy', 'seed-sinigang-na-bangus', 'seed-sinigang-na-hipon'];
    expect(result.some((id) => relevant.includes(id)), `top 3: ${result.join(', ')}`).toBe(true);
  });

  it('"pansit" (alternate spelling) finds pancit noodles', () => {
    const result = top('pansit');
    const relevant = ['seed-pancit-canton', 'seed-pancit-bihon', 'seed-pancit-malabon'];
    expect(result.some((id) => relevant.includes(id)), `top 3: ${result.join(', ')}`).toBe(true);
  });

  it('"tapsilog" finds tapsilog first', () => {
    const result = top('tapsilog');
    expect(result[0], `top 3: ${result.join(', ')}`).toBe('seed-tapsilog');
  });
});

describe('normalization', () => {
  it('ignores case', () => {
    expect(ids(searchFoods(seedFoods, 'ADOBO', { limit: 3 }))).toEqual(top('adobo'));
    expect(normalize('Pork ADOBO')).toBe('pork adobo');
  });

  it('ignores diacritics in the query and in the data', () => {
    expect(normalize('Bisték')).toBe('bistek');
    expect(normalize('Menúdo')).toBe('menudo');
    expect(normalize('Tahô')).toBe('taho');

    for (const query of ['bistek', 'bisték', 'BÍSTEK']) {
      expect(ids(searchFoods(seedFoods, query, { limit: 3 })), query).toContain(
        'seed-bistek-tagalog',
      );
    }
  });

  it('ignores extra whitespace and punctuation', () => {
    expect(ids(searchFoods(seedFoods, '  sago   gulaman ', { limit: 3 }))).toContain(
      'seed-sagot-gulaman',
    );
  });
});

describe('alias matching', () => {
  it('finds a food by an English alias', () => {
    expect(ids(searchFoods(seedFoods, 'adobong manok', { limit: 3 }))[0]).toBe('seed-chicken-adobo');
  });

  it('finds a food by a Tagalog alias', () => {
    expect(ids(searchFoods(seedFoods, 'kanin', { limit: 3 }))).toContain('seed-plain-rice');
  });

  it('finds a food by a substring that is not at the start of a word', () => {
    // "silog" appears inside "Tapsilog"/"Tocilog" etc., never at the start.
    expect(ids(searchFoods(seedFoods, 'silog', { limit: 10 }))).toContain('seed-tapsilog');
  });
});

describe('ranking', () => {
  const foods = [
    makeFood({ id: 'exact', name: 'Rice' }),
    makeFood({ id: 'prefix', name: 'Rice Porridge' }),
    makeFood({ id: 'alias-prefix', name: 'Arroz Caldo', aliases: ['rice porridge'] }),
    makeFood({ id: 'word-prefix', name: 'Fried Rice' }),
  ];

  it('puts prefix matches above substring matches and names above aliases', () => {
    expect(ids(searchFoods(foods, 'rice'))).toEqual(['exact', 'prefix', 'alias-prefix', 'word-prefix']);
  });

  it('is case-insensitive', () => {
    expect(ids(searchFoods(foods, 'RICE'))).toEqual(['exact', 'prefix', 'alias-prefix', 'word-prefix']);
  });
});

describe('filters and limits', () => {
  it('filters by category', () => {
    const results = searchFoods(seedFoods, 'adobo', { category: 'vegetables' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((food) => food.category === 'vegetables')).toBe(true);
    expect(ids(results)).toContain('seed-adobong-kangkong');
  });

  it('hides hidden foods unless asked for them', () => {
    const visible = makeFood({ id: 'visible', name: 'Adobo Rice' });
    const hidden = makeFood({ id: 'hidden', name: 'Adobo Hidden', hidden: true });

    expect(ids(searchFoods([visible, hidden], 'adobo'))).toEqual(['visible']);
    // Same score, so the shorter name ("Adobo Rice") comes first.
    expect(ids(searchFoods([visible, hidden], 'adobo', { includeHidden: true }))).toEqual([
      'visible',
      'hidden',
    ]);
  });

  it('returns everything alphabetically for an empty query', () => {
    const foods = [
      makeFood({ id: 'banana', name: 'Banana' }),
      makeFood({ id: 'apple', name: 'Apple' }),
      makeFood({ id: 'cherry', name: 'Cherry' }),
    ];
    expect(ids(searchFoods(foods, '   '))).toEqual(['apple', 'banana', 'cherry']);
  });

  it('respects the limit', () => {
    expect(searchFoods(seedFoods, '', { limit: 5 })).toHaveLength(5);
    expect(searchFoods(seedFoods, 'a', { limit: 3 })).toHaveLength(3);
  });

  it('returns nothing for an unknown query', () => {
    expect(searchFoods(seedFoods, 'zzzzzz')).toEqual([]);
  });
});
