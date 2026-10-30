import { useState } from 'react';
import {
  createCustomMeal,
  updateCustomMeal,
  type CustomMealInput,
} from '../db/logActions';
import { formatKcal } from '../lib/format';
import { searchFoods } from '../lib/search';
import type { CustomMeal, CustomMealItem, Food } from '../types';
import { Sheet, Stepper } from './ui';

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

  async function save(): Promise<void> {
    if (saving || name.trim().length === 0 || items.length === 0) return;
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
                    <span className="min-w-0 truncate text-sm">
                      {food?.name ?? 'Unavailable food'}
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
                  <div className="mt-1">
                    <Stepper
                      value={item.servings}
                      onChange={(servings) => setServings(item.foodId, servings)}
                      label={`Servings of ${food?.name ?? 'food'}`}
                    />
                  </div>
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
        disabled={saving || name.trim().length === 0 || items.length === 0}
        onClick={() => void save()}
        className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40"
      >
        Save meal
      </button>
    </Sheet>
  );
}
