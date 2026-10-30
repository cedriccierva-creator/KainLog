#!/usr/bin/env node
/**
 * Validates src/data/foods.ph.json (or a path passed as argv[2]).
 *
 * IMPORTANT: this checks INTERNAL CONSISTENCY ONLY (fields, duplicates, macro
 * math). It does NOT verify that the numbers match reality. Every seed row is
 * an estimate and is marked verified:false / source:"seed-estimate".
 *
 * Plain Node on purpose: the data must be checkable before any TypeScript runs.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_CATEGORIES = [
  'ulam',
  'fish-seafood',
  'vegetables',
  'silog-breakfast',
  'rice',
  'noodles',
  'street-food',
  'merienda-desserts',
  'drinks',
  'fruits',
  'fast-food',
];

const MIN_FOODS = 150;
const MIN_PER_CATEGORY = 5;
const MAX_FAST_FOOD = 10;
const KCAL_TOLERANCE = 0.2;
const MAX_KCAL_EXCEPTIONS = 10;
const EXCEPTION_MARKER = 'kcal-exception:';
const FAST_FOOD_PHRASE = 'check the official nutrition info';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const filePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(scriptDir, '..', 'src', 'data', 'foods.ph.json');

const problems = [];
const problem = (message) => problems.push(message);

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegative = (value) => isFiniteNumber(value) && value >= 0;

/** Same normalization as src/lib/search.ts: lowercase, no accents, single spaces. */
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

let foods;
try {
  foods = JSON.parse(readFileSync(filePath, 'utf8'));
} catch (error) {
  console.error(`✖ Could not read ${filePath}: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(foods)) {
  console.error(`✖ ${filePath} must contain a JSON array of foods.`);
  process.exit(1);
}

const categoryCounts = Object.fromEntries(ALLOWED_CATEGORIES.map((category) => [category, 0]));
const nameOwner = new Map();
const aliasOwner = new Map();
const exceptions = [];
let fastFoodCount = 0;

foods.forEach((food, index) => {
  const where = `#${index} ${isNonEmptyString(food?.id) ? food.id : '(missing id)'}`;

  if (food === null || typeof food !== 'object' || Array.isArray(food)) {
    problem(`${where}: entry must be an object`);
    return;
  }

  // --- required text fields ---
  for (const field of ['id', 'name', 'category', 'servingLabel']) {
    if (!isNonEmptyString(food[field])) problem(`${where}: missing or empty "${field}"`);
  }

  // --- category ---
  if (isNonEmptyString(food.category)) {
    if (!ALLOWED_CATEGORIES.includes(food.category)) {
      problem(`${where}: unknown category "${food.category}"`);
    } else {
      categoryCounts[food.category] += 1;
      if (food.category === 'fast-food') fastFoodCount += 1;
    }
  }

  // --- aliases ---
  if (!Array.isArray(food.aliases)) {
    problem(`${where}: "aliases" must be an array`);
  } else {
    food.aliases.forEach((alias, aliasIndex) => {
      if (!isNonEmptyString(alias)) problem(`${where}: alias[${aliasIndex}] must be a non-empty string`);
    });
  }

  // --- servings ---
  if (!isFiniteNumber(food.servingGrams) || food.servingGrams <= 0) {
    problem(`${where}: "servingGrams" must be a number > 0`);
  }

  if (!Array.isArray(food.altServings)) {
    problem(`${where}: "altServings" must be an array`);
  } else {
    food.altServings.forEach((alt, altIndex) => {
      if (alt === null || typeof alt !== 'object') {
        problem(`${where}: altServings[${altIndex}] must be an object`);
        return;
      }
      if (!isNonEmptyString(alt.label)) problem(`${where}: altServings[${altIndex}].label is required`);
      if (!isFiniteNumber(alt.grams) || alt.grams <= 0) {
        problem(`${where}: altServings[${altIndex}].grams must be > 0`);
      }
    });
  }

  // --- macros ---
  for (const field of ['kcal', 'proteinG', 'carbsG', 'fatG']) {
    if (!isNonNegative(food[field])) problem(`${where}: "${field}" must be a number >= 0`);
  }
  for (const field of ['fiberG', 'sodiumMg']) {
    if (food[field] !== undefined && !isNonNegative(food[field])) {
      problem(`${where}: "${field}" must be a number >= 0 when present`);
    }
  }

  // --- honesty rules ---
  if (typeof food.isFilipino !== 'boolean') problem(`${where}: "isFilipino" must be a boolean`);
  if (typeof food.verified !== 'boolean') problem(`${where}: "verified" must be a boolean`);
  if (food.verified !== false) problem(`${where}: seed entries must have verified:false (never lab-verified)`);
  if (food.source !== 'seed-estimate') problem(`${where}: seed entries must have source:"seed-estimate"`);
  if (food.notes !== undefined && !isNonEmptyString(food.notes)) {
    problem(`${where}: "notes" must be a non-empty string when present`);
  }

  // --- fast food notes ---
  if (food.category === 'fast-food') {
    const notes = typeof food.notes === 'string' ? food.notes.toLowerCase() : '';
    if (!notes.includes(FAST_FOOD_PHRASE)) {
      problem(`${where}: fast-food notes must include "${FAST_FOOD_PHRASE}"`);
    }
  }

  // --- physical plausibility (non-circular: uses the serving weight, not the macro math) ---
  const macrosValid =
    isNonNegative(food.proteinG) && isNonNegative(food.carbsG) && isNonNegative(food.fatG);
  const servingValid = isFiniteNumber(food.servingGrams) && food.servingGrams > 0;

  if (macrosValid && servingValid) {
    const macroGrams = food.proteinG + food.carbsG + food.fatG;
    if (macroGrams > food.servingGrams) {
      problem(
        `${where}: protein+carbs+fat total ${macroGrams.toFixed(1)} g, more than the ${food.servingGrams} g serving can weigh`,
      );
    }
    if (isNonNegative(food.kcal) && food.kcal > 9 * food.servingGrams) {
      problem(
        `${where}: kcal ${food.kcal} exceeds the maximum possible 9 × servingGrams (${9 * food.servingGrams}); pure fat is 9 kcal/g`,
      );
    }
    if (isNonNegative(food.fiberG) && isNonNegative(food.carbsG) && food.fiberG > food.carbsG) {
      problem(`${where}: fiberG ${food.fiberG} is higher than carbsG ${food.carbsG}; fiber is part of carbohydrate`);
    }
  }

  // --- kcal vs macros ---
  if (isNonNegative(food.kcal) && isNonNegative(food.proteinG) && isNonNegative(food.carbsG) && isNonNegative(food.fatG)) {
    const expected = 4 * food.proteinG + 4 * food.carbsG + 9 * food.fatG;
    const hasException = typeof food.notes === 'string' && food.notes.includes(EXCEPTION_MARKER);
    if (expected === 0) {
      if (food.kcal !== 0 && !hasException) {
        problem(`${where}: kcal is ${food.kcal} but macros imply 0 (add a "${EXCEPTION_MARKER}" note to justify)`);
      }
    } else {
      const deviation = Math.abs(food.kcal - expected) / expected;
      if (deviation > KCAL_TOLERANCE) {
        if (hasException) {
          exceptions.push(food.id);
        } else {
          problem(
            `${where}: kcal ${food.kcal} differs ${(deviation * 100).toFixed(1)}% from 4P+4C+9F (${expected.toFixed(0)}); fix it or justify with a "${EXCEPTION_MARKER}" note`,
          );
        }
      }
    }
  }

  // --- duplicate names ---
  if (isNonEmptyString(food.name)) {
    const key = normalize(food.name);
    if (nameOwner.has(key)) {
      problem(`${where}: duplicate name "${food.name}" (also used by ${nameOwner.get(key)})`);
    } else {
      nameOwner.set(key, food.id);
    }
  }
});

// --- alias collisions need every name first ---
foods.forEach((food) => {
  if (food === null || typeof food !== 'object' || !Array.isArray(food.aliases)) return;
  const where = `#${food.id ?? '(missing id)'}`;
  const ownName = isNonEmptyString(food.name) ? normalize(food.name) : '';

  food.aliases.forEach((alias) => {
    if (!isNonEmptyString(alias)) return;
    const key = normalize(alias);

    if (key === ownName) {
      problem(`${where}: alias "${alias}" repeats the food's own name`);
      return;
    }
    const nameClash = nameOwner.get(key);
    if (nameClash !== undefined && nameClash !== food.id) {
      problem(`${where}: alias "${alias}" collides with the name of ${nameClash}`);
      return;
    }
    const aliasClash = aliasOwner.get(key);
    if (aliasClash !== undefined) {
      problem(`${where}: alias "${alias}" collides with an alias of ${aliasClash === food.id ? 'this same food' : aliasClash}`);
      return;
    }
    aliasOwner.set(key, food.id);
  });
});

// --- ids ---
const idOwner = new Map();
foods.forEach((food) => {
  if (!isNonEmptyString(food?.id)) return;
  if (idOwner.has(food.id)) {
    problem(`duplicate id "${food.id}"`);
  } else {
    idOwner.set(food.id, true);
  }
});

// --- collection level rules ---
if (foods.length < MIN_FOODS) {
  problem(`only ${foods.length} foods; need at least ${MIN_FOODS}`);
}
for (const category of ALLOWED_CATEGORIES) {
  if (categoryCounts[category] < MIN_PER_CATEGORY) {
    problem(`category "${category}" has ${categoryCounts[category]}; need at least ${MIN_PER_CATEGORY}`);
  }
}
if (fastFoodCount > MAX_FAST_FOOD) {
  problem(`${fastFoodCount} fast-food entries; maximum is ${MAX_FAST_FOOD}`);
}
if (exceptions.length > MAX_KCAL_EXCEPTIONS) {
  problem(`${exceptions.length} kcal exceptions; maximum is ${MAX_KCAL_EXCEPTIONS} (${exceptions.join(', ')})`);
}

// --- report ---
const relative = path.relative(process.cwd(), filePath) || filePath;
console.log(`KainLog food validator — ${relative}`);
console.log(`Foods: ${foods.length}`);
console.log('Per category:');
for (const category of ALLOWED_CATEGORIES) {
  console.log(`  ${category.padEnd(20)} ${categoryCounts[category]}`);
}
console.log(`Fast food: ${fastFoodCount} (max ${MAX_FAST_FOOD})`);
console.log(`Kcal exceptions: ${exceptions.length} (max ${MAX_KCAL_EXCEPTIONS})`);
console.log('Scope: internal consistency only — these are estimates, not lab-verified values.');

if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} problem(s):`);
  for (const message of problems) console.error(`  - ${message}`);
  process.exit(1);
}

console.log('\n✔ All checks passed.');
