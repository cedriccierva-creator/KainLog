import { useState } from 'react';
import { AmountField } from './AmountField';
import {
  createCustomMeal,
  updateCustomMeal,
  type CustomMealInput,
} from '../db/logActions';
import { formatGrams, formatKcal, formatServings } from '../lib/format';
import {
  gramsFromServings,
  parseGramAmount,
  servingsFromGrams,
} from '../lib/nutrition';
import { searchFoods } from '../lib/search';
import type { AmountMode, CustomMeal, CustomMealItem, Food } from '../types';
import { Sheet } from './ui';

export default function MealFormSheet({
  customMeal,
  foods,
  onClose,
}: {
  customMeal: CustomMeal | null;
  foods: Food[];
  onClose: () => void;
}) {
  const [name, setName] = useState(customMeal?.name ?? '');
  const [items, setItems] = useState<CustomMealItem[]>(customMeal?.items ?? []);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  // Per-item UI state. Only servings are stored: grams are derived from the
  // food's current servingGrams every time the row is shown.
  const [modes, setModes] = useState<Record<string, AmountMode>>({});
  const [gramsTexts, setGramsTexts] = useState<Record<string, string>>({});

  const foodById = new Map(foods.map((food) => [food.id, food]));
  const picks = query.trim()
    ? searchFoods(foods, query, { limit: 10 })
    : searchFoods(foods, '', { limit: 8 });

  const total = items.reduce((sum, item) => {
    const food = foodById.get(item.foodId);
    return food ? sum + food.kcal * item.servings : sum;
  }, 0);

  function addItem(food: Food): void {
    setItems((previous) =>
      previous.some((item) => item.foodId === food.id)
        ? previous
        : [...previous, { foodId: food.id, servings: 1 }],
    );
  }

  function setServings(foodId: string, servings: number): void {
    setItems((previous) =>
      previous.map((item) => (item.foodId === foodId ? { ...item, servings } : item)),
    );
  }

  function removeItem(foodId: string): void {
    setItems((previous) => previous.filter((item) => item.foodId !== foodId));
  }

  const modeFor = (foodId: string): AmountMode => modes[foodId] ?? 'servings';
  const gramsTextFor = (food: Food, item: CustomMealItem): string =>
    gramsTexts[food.id] ?? formatGrams(gramsFromServings(item.servings, food.servingGrams));

  function changeMode(food: Food, item: CustomMealItem, next: AmountMode): void {
    setModes((previous) => ({ ...previous, [food.id]: next }));
    setGramsTexts((previous) => ({
      ...previous,
      [food.id]: formatGrams(gramsFromServings(item.servings, food.servingGrams)),
    }));
  }

  function changeGrams(food: Food, text: string): void {
    setGramsTexts((previous) => ({ ...previous, [food.id]: text }));
    const grams = parseGramAmount(text);
    if (grams !== null) setServings(food.id, servingsFromGrams(grams, food.servingGrams));
  }

  const invalidGrams = items.some((item) => {
    const food = foodById.get(item.foodId);
    return (
      food !== undefined &&
      modeFor(item.foodId) === 'grams' &&
      parseGramAmount(gramsTexts[food.id] ?? '') === null
    );
  });

  async function save(): Promise<void> {
    if (saving || invalidGrams || name.trim().length === 0 || items.length === 0) return;
    setSaving(true);
    const input: CustomMealInput = { name: name.trim(), items };

    try {
      if (customMeal) {
        await updateCustomMeal(customMeal.id, input);
      } else {
        await createCustomMeal(input);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open title={customMeal ? `Edit ${customMeal.name}` : 'New meal'} onClose={onClose}>
      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Meal name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Tapsilog"
          className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <div className="mt-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Items · {formatKcal(total)} kcal
        </p>
        {items.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Add at least one food below.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((item) => {
              const food = foodById.get(item.foodId);
              return (
                <li key={item.foodId} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {food?.name ?? 'Missing food'}
                      </span>
                      {food ? null : (
                        <span className="block text-xs font-medium text-rose-600 dark:text-rose-400">
                          food no longer exists
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${food?.name ?? 'food'}`}
                      onClick={() => removeItem(item.foodId)}
                      className="min-h-12 rounded-lg px-2 text-sm text-rose-600 dark:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                  {food ? (
                    <div className="mt-1">
                      <AmountField
                        servings={item.servings}
                        servingGrams={food.servingGrams}
                        mode={modeFor(item.foodId)}
                        gramsText={gramsTextFor(food, item)}
                        gramsError={
                          modeFor(item.foodId) === 'grams' &&
                          parseGramAmount(gramsTexts[food.id] ?? '') === null
                            ? 'Enter grams between 0.1 and 10000.'
                            : undefined
                        }
                        onModeChange={(next) => changeMode(food, item, next)}
                        onServingsChange={(servings) => setServings(item.foodId, servings)}
                        onGramsTextChange={(text) => changeGrams(food, text)}
                        label={`Servings of ${food.name}`}
                      />
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatServings(item.servings)} servings ·{' '}
                        {formatGrams(gramsFromServings(item.servings, food.servingGrams))} g
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Add a food</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the library"
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <ul className="mt-1 max-h-56 overflow-y-auto">
          {picks.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                aria-label={`Add ${food.name} to meal`}
                onClick={() => addItem(food)}
                className="flex min-h-12 w-full items-center justify-between gap-2 border-b border-slate-200 py-1 text-left text-sm dark:border-slate-800"
              >
                <span className="min-w-0 truncate">{food.name}</span>
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {formatKcal(food.kcal)} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        disabled={saving || invalidGrams || name.trim().length === 0 || items.length === 0}
        onClick={() => void save()}
        className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40"
      >
        Save meal
      </button>
    </Sheet>
  );
}
