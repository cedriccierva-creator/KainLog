import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import FoodFormSheet from '../components/FoodFormSheet';
import FoodListItem from '../components/FoodListItem';
import MealFormSheet from '../components/MealFormSheet';
import { FoodBadges, Sheet } from '../components/ui';
import { db } from '../db/db';
import { setFoodHidden } from '../db/logActions';
import { CATEGORY_LABELS } from '../lib/categories';
import { formatGrams, formatKcal } from '../lib/format';
import { searchFoods } from '../lib/search';
import { FOOD_CATEGORIES, type CustomMeal, type Food, type FoodCategory } from '../types';

export default function FoodsScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');
  const [selected, setSelected] = useState<Food | null>(null);
  const [editingFood, setEditingFood] = useState<Food | 'new' | null>(null);
  const [editingMeal, setEditingMeal] = useState<CustomMeal | 'new' | null>(null);

  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const meals = useLiveQuery(() => db.customMeals.toArray(), []);

  const allFoods = foods ?? [];
  const allMeals = meals ?? [];
  const foodById = useMemo(
    () => new Map((foods ?? []).map((food) => [food.id, food])),
    [foods],
  );

  // Browse includes hidden foods so they can be un-hidden; Add Food never shows them.
  const results = useMemo(
    () => searchFoods(foods ?? [], query, { category, includeHidden: true, limit: 200 }),
    [foods, query, category],
  );

  const mealKcal = (meal: CustomMeal): number =>
    meal.items.reduce((sum, item) => {
      const food = foodById.get(item.foodId);
      return food ? sum + food.kcal * item.servings : sum;
    }, 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-2 pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Foods</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {allFoods.length} foods · {allMeals.length} custom meals
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingMeal('new')}
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium dark:border-slate-800 dark:bg-slate-900"
          >
            New meal
          </button>
          <button
            type="button"
            onClick={() => setEditingFood('new')}
            className="min-h-12 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white"
          >
            New food
          </button>
        </div>
      </header>

      {allMeals.length > 0 ? (
        <section
          aria-label="Custom meals"
          className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="px-1 py-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            My meals
          </h2>
          <ul>
            {allMeals.map((meal) => (
              <li key={meal.id} className="flex items-center gap-1 border-t border-slate-200 dark:border-slate-800">
                <div className="min-w-0 flex-1 px-1 py-2">
                  <p className="truncate text-sm font-medium">{meal.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {meal.items.length} items · {formatKcal(mealKcal(meal))} kcal
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Edit meal ${meal.name}`}
                  onClick={() => setEditingMeal(meal)}
                  className="min-h-12 rounded-lg px-3 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search the library"
        placeholder="Search foods and aliases"
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
          className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-medium ${
            category === 'all'
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          All
        </button>
        {FOOD_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
            className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-medium ${
              category === value
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {CATEGORY_LABELS[value]}
          </button>
        ))}
      </div>

      <section
        aria-label="Food library"
        className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
      >
        {results.length === 0 ? (
          <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
            No foods match. Create one with “New food”.
          </p>
        ) : (
          <ul>
            {results.map((food) => (
              <FoodListItem key={food.id} food={food} onSelect={() => setSelected(food)} />
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <FoodDetailSheet
          key={selected.id}
          food={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditingFood(selected);
            setSelected(null);
          }}
          onToggleHidden={async () => {
            await setFoodHidden(selected.id, !selected.hidden);
            setSelected(null);
          }}
        />
      ) : null}

      {editingFood ? (
        <FoodFormSheet
          food={editingFood === 'new' ? null : editingFood}
          onClose={() => setEditingFood(null)}
        />
      ) : null}

      {editingMeal ? (
        <MealFormSheet
          customMeal={editingMeal === 'new' ? null : editingMeal}
          foods={allFoods}
          onClose={() => setEditingMeal(null)}
        />
      ) : null}
    </div>
  );
}

function FoodDetailSheet({
  food,
  onClose,
  onEdit,
  onToggleHidden,
}: {
  food: Food;
  onClose: () => void;
  onEdit: () => void;
  onToggleHidden: () => Promise<void>;
}) {
  return (
    <Sheet open title={food.name} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {food.servingLabel} · {formatGrams(food.servingGrams)} g
        </p>
        <FoodBadges food={food} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-800">
        {[
          ['kcal', formatKcal(food.kcal)],
          ['protein', formatGrams(food.proteinG)],
          ['carbs', formatGrams(food.carbsG)],
          ['fat', formatGrams(food.fatG)],
          ['fiber', formatGrams(food.fiberG ?? 0)],
          ['sodium', `${formatKcal(food.sodiumMg ?? 0)} mg`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {food.aliases.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Also called: {food.aliases.join(', ')}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {food.source === 'seed-estimate'
          ? 'Estimate based on typical Filipino recipes. Not lab-verified.'
          : 'Your own values.'}
      </p>

      {food.notes ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {food.notes}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-12 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
        >
          Edit food
        </button>
        <button
          type="button"
          onClick={() => void onToggleHidden()}
          className="min-h-12 rounded-xl border border-slate-300 text-sm font-medium dark:border-slate-700"
        >
          {food.hidden ? 'Unhide food' : 'Hide food'}
        </button>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Hidden foods stay in past entries but disappear from search and Add Food.
        </p>
      </div>
    </Sheet>
  );
}
