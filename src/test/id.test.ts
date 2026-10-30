// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { createCustomMeal, createFood } from '../db/logActions';
import { seedFoods } from '../db/seed';
import { newId } from '../lib/id';
import { createLogEntry } from '../lib/nutrition';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let randomUuidDescriptor: PropertyDescriptor | undefined;
let randomValuesDescriptor: PropertyDescriptor | undefined;

function hideCryptoMethod(name: 'randomUUID' | 'getRandomValues'): void {
  Object.defineProperty(globalThis.crypto, name, { value: undefined, configurable: true });
}

beforeEach(async () => {
  randomUuidDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
  randomValuesDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'getRandomValues');
  await db.delete();
  await db.open();
});

afterEach(() => {
  // Restore the real Web Crypto for the rest of the suite.
  if (randomUuidDescriptor) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', randomUuidDescriptor);
  } else {
    delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID;
  }
  if (randomValuesDescriptor) {
    Object.defineProperty(globalThis.crypto, 'getRandomValues', randomValuesDescriptor);
  } else {
    delete (globalThis.crypto as { getRandomValues?: unknown }).getRandomValues;
  }
});

describe('newId', () => {
  it('produces v4 ids with the native generator', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it('falls back to getRandomValues when randomUUID is unavailable (non-secure context)', () => {
    hideCryptoMethod('randomUUID');

    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it('still returns v4 ids when Web Crypto is entirely missing', () => {
    hideCryptoMethod('randomUUID');
    hideCryptoMethod('getRandomValues');

    expect(newId()).toMatch(V4);
    expect(newId()).not.toBe(newId());
  });

  it('is used by entry, food and custom-meal creation', async () => {
    hideCryptoMethod('randomUUID');

    const food = seedFoods[0];
    expect(food).toBeDefined();
    if (!food) return;

    const entry = createLogEntry(food, { date: '2026-10-31', meal: 'lunch', servings: 1 });
    expect(entry.id).toMatch(V4);
    expect(entry.id).not.toMatch(/^[0-9]+$/);

    const createdFood = await createFood({
      name: 'Test food',
      aliases: [],
      category: 'ulam',
      servingLabel: '1 plate',
      servingGrams: 200,
      kcal: 300,
      proteinG: 20,
      carbsG: 30,
      fatG: 10,
    });
    expect(createdFood.id).toMatch(V4);

    const meal = await createCustomMeal({
      name: 'Test meal',
      items: [{ foodId: food.id, servings: 1 }],
    });
    expect(meal.id).toMatch(V4);
  });
});
