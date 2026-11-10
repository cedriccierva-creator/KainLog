import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import categoriesJson from '../data/categories.json';
import { seedFoods } from '../db/seed';
import { CATEGORY_LABELS } from '../lib/categories';
import { FOOD_CATEGORIES } from '../types';

const validatorSource = readFileSync(
  new URL('../../scripts/validate-foods.mjs', import.meta.url),
  'utf8',
);

describe('category parity', () => {
  it('keeps types, labels, the validator and the JSON list in lockstep', () => {
    // src/data/categories.json is the one list the Node validator can read.
    expect([...FOOD_CATEGORIES]).toEqual(categoriesJson);
    expect(Object.keys(CATEGORY_LABELS)).toEqual([...FOOD_CATEGORIES]);

    // No duplicates and no empty names.
    expect(new Set(categoriesJson).size).toBe(categoriesJson.length);
    expect(categoriesJson.every((category) => category.trim().length > 0)).toBe(true);
  });

  it('makes the validator use the shared list instead of its own copy', () => {
    expect(validatorSource).toContain('categories.json');
    expect(validatorSource).not.toMatch(/const ALLOWED_CATEGORIES = \[/);
  });

  it('never seeds the "other" import fallback', () => {
    expect(FOOD_CATEGORIES).toContain('other');
    expect(seedFoods.some((food) => food.category === 'other')).toBe(false);
  });
});
