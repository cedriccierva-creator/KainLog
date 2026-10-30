import { describe, expect, it } from 'vitest';
import { seedFoods } from '../db/seed';
import { FOOD_CATEGORIES } from '../types';

/**
 * Every dish the original brief names must exist in the shipped library.
 * Keys are the brief's wording; values are the seed ids that satisfy it.
 */
const REQUIRED_DISHES: Record<string, string[]> = {
  // Ulam: pork / beef / chicken
  adobo: ['seed-pork-adobo', 'seed-chicken-adobo'],
  sinigang: ['seed-sinigang-na-baboy', 'seed-sinigang-na-bangus', 'seed-sinigang-na-hipon'],
  tinola: ['seed-chicken-tinola'],
  nilaga: ['seed-nilagang-baka', 'seed-nilagang-baboy'],
  menudo: ['seed-menudo'],
  afritada: ['seed-chicken-afritada', 'seed-pork-afritada'],
  caldereta: ['seed-beef-caldereta'],
  'kare-kare': ['seed-kare-kare'],
  'bicol express': ['seed-bicol-express'],
  sisig: ['seed-sisig'],
  'lechon kawali': ['seed-lechon-kawali'],
  bistek: ['seed-bistek-tagalog'],
  dinuguan: ['seed-dinuguan'],
  'pork bbq': ['seed-pork-bbq'],
  'chicken bbq': ['seed-chicken-bbq'],
  'inihaw na liempo': ['seed-inihaw-na-liempo'],

  // Fish / seafood
  bangus: ['seed-fried-bangus', 'seed-inihaw-na-bangus', 'seed-sinigang-na-bangus'],
  tilapia: ['seed-fried-tilapia', 'seed-inihaw-na-tilapia'],
  tuyo: ['seed-tuyo'],
  daing: ['seed-daing-na-bangus'],
  galunggong: ['seed-galunggong', 'seed-paksiw-na-galunggong'],
  'ginataang hipon': ['seed-ginataang-hipon'],
  'sinigang na hipon': ['seed-sinigang-na-hipon'],

  // Vegetables
  pinakbet: ['seed-pinakbet'],
  laing: ['seed-laing'],
  chopsuey: ['seed-chopsuey'],
  'ginisang munggo': ['seed-ginisang-munggo'],
  'ensaladang talong': ['seed-ensaladang-talong'],
  'ginataang kalabasa': ['seed-ginataang-kalabasa'],

  // Silog and breakfast
  tapsilog: ['seed-tapsilog'],
  tocilog: ['seed-tocilog'],
  longsilog: ['seed-longsilog'],
  bangsilog: ['seed-bangsilog'],
  champorado: ['seed-champorado'],
  'arroz caldo': ['seed-arroz-caldo'],
  lugaw: ['seed-lugaw'],

  // Rice
  'plain rice': ['seed-plain-rice'],
  sinangag: ['seed-sinangag'],
  bringhe: ['seed-bringhe'],

  // Noodles
  'pancit canton': ['seed-pancit-canton'],
  bihon: ['seed-pancit-bihon'],
  palabok: ['seed-palabok'],
  sotanghon: ['seed-sotanghon'],
  lomi: ['seed-lomi'],
  batchoy: ['seed-batchoy'],
  mami: ['seed-mami'],

  // Street food
  fishball: ['seed-fishball'],
  'kwek-kwek': ['seed-kwek-kwek'],
  isaw: ['seed-isaw'],
  betamax: ['seed-betamax'],
  balut: ['seed-balut'],
  'banana cue': ['seed-banana-cue'],
  'camote cue': ['seed-camote-cue'],
  turon: ['seed-turon'],
  siomai: ['seed-siomai'],

  // Merienda and desserts
  pandesal: ['seed-pandesal'],
  ensaymada: ['seed-ensaymada'],
  bibingka: ['seed-bibingka'],
  puto: ['seed-puto'],
  kutsinta: ['seed-kutsinta'],
  'halo-halo': ['seed-halo-halo'],
  'leche flan': ['seed-leche-flan'],
  'ube halaya': ['seed-ube-halaya'],
  taho: ['seed-taho'],
  'maja blanca': ['seed-maja-blanca'],
  biko: ['seed-biko'],
  'lumpia shanghai': ['seed-lumpiang-shanghai'],
  'lumpia fresh': ['seed-fresh-lumpia'],

  // Drinks
  '3-in-1 coffee': ['seed-three-in-one-coffee'],
  "sago't gulaman": ['seed-sagot-gulaman'],
  'buko juice': ['seed-buko-juice'],
  'calamansi juice': ['seed-calamansi-juice'],
  milo: ['seed-milo'],
  'soft drinks': ['seed-soft-drink'],

  // Fruits
  mango: ['seed-mango'],
  saba: ['seed-saba'],
  lakatan: ['seed-lakatan'],
  papaya: ['seed-papaya'],
  pakwan: ['seed-pakwan'],
  pineapple: ['seed-pineapple'],
  calamansi: ['seed-calamansi'],

  // Fast food examples named in the brief
  'jollibee chickenjoy': ['seed-jollibee-chickenjoy'],
  'jolly spaghetti': ['seed-jolly-spaghetti'],
  'burger steak': ['seed-jollibee-burger-steak'],
  'mang inasal': ['seed-mang-inasal-inasal'],
};

const seedIds = new Set(seedFoods.map((food) => food.id));

describe('brief coverage', () => {
  it('contains every dish named in the original brief', () => {
    const missing = Object.entries(REQUIRED_DISHES).flatMap(([dish, ids]) =>
      ids.filter((id) => !seedIds.has(id)).map((id) => `${dish} → ${id}`),
    );
    expect(missing).toEqual([]);
  });

  it('keeps at least 5 foods in every category', () => {
    for (const category of FOOD_CATEGORIES) {
      const count = seedFoods.filter((food) => food.category === category).length;
      expect(count, category).toBeGreaterThanOrEqual(5);
    }
  });

  it('gives rice, bread and common ulam realistic alternate servings', () => {
    for (const food of seedFoods.filter((item) => item.category === 'rice')) {
      expect(food.altServings.length, food.name).toBeGreaterThan(0);
    }

    const portioned = [
      'seed-pandesal',
      'seed-white-bread',
      'seed-ensaymada',
      'seed-puto',
      'seed-kutsinta',
      'seed-pork-adobo',
      'seed-chicken-adobo',
      'seed-sinigang-na-baboy',
      'seed-menudo',
      'seed-beef-caldereta',
      'seed-sisig',
      'seed-kare-kare',
    ];

    for (const id of portioned) {
      const food = seedFoods.find((item) => item.id === id);
      expect(food, id).toBeDefined();
      if (!food) continue;
      expect(food.altServings.length, id).toBeGreaterThan(0);
      expect(food.altServings.every((alt) => alt.grams > 0), id).toBe(true);
      // The data has to say out loud that portion grams are estimates.
      expect((food.notes ?? '').toLowerCase(), id).toContain('estimates');
    }
  });

  it('keeps the fast-food category at 10 or fewer', () => {
    expect(seedFoods.filter((food) => food.category === 'fast-food').length).toBeLessThanOrEqual(
      10,
    );
  });
});
