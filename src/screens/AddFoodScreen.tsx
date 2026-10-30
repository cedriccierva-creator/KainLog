import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import FoodListItem from '../components/FoodListItem';
import { FoodBadges, Sheet, Stepper } from '../components/ui';
import { db } from '../db/db';
import { logCustomMeal, logFood } from '../db/logActions';
import { getFrequentFoods, getRecentFoods } from '../db/queries';
import { CATEGORY_LABELS } from '../lib/categories';
import { formatDayLabel, todayKey } from '../lib/date';
import { formatKcal } from '../lib/format';
import { MEAL_LABELS, isMeal } from '../lib/meals';
import { roundServings, scaleNutrition, snapshotFromFood } from '../lib/nutrition';
import { searchFoods } from '../lib/search';
import {
  FOOD_CATEGORIES,
  type CustomMeal,
  type Food,
  type FoodCategory,
  type Meal,
} from '../types';


export default function AddFoodScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const date = searchParams.get('date') ?? todayKey();
  const mealParam = searchParams.get('meal');
  const meal: Meal = isMeal(mealParam) ? mealParam : 'lunch';

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<CustomMeal | null>(null);

  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const recent = useLiveQuery(() => getRecentFoods(6), []);
  const frequent = useLiveQuery(() => getFrequentFoods(6), []);
  const customMeals = useLiveQuery(() => db.customMeals.toArray(), []);

  const recentFoods = recent ?? [];
  const frequentFoods = frequent ?? [];
  const meals = customMeals ?? [];

  const results = useMemo(
    () => searchFoods(foods ?? [], query, { category, limit: 60 }),
    [foods, query, category],
  );
  const foodById = useMemo(
    () => new Map((foods ?? []).map((food) => [food.id, food])),
    [foods],
  );
  const isFiltering = query.trim().length > 0 || category !== 'all';
  const finish = () => navigate(`/?date=${date}`);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start gap-2 pt-2">
        <Link
          to={`/?date=${date}`}
          aria-label="Back to diary"
          className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg dark:border-slate-800 dark:bg-slate-900"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Add food</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {MEAL_LABELS[meal]} · {formatDayLabel(date)} · {date}
          </p>
        </div>
      </header>

      {/* Autofocused: typing is the fastest way in. Hidden foods never appear here. */}
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search foods"
        placeholder="Search adobo, pansit, tapsilog…"
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

      {isFiltering ? (
        <section aria-label="Search results" className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
              No foods match “{query.trim()}”. Try another spelling or add a custom food.
            </p>
          ) : (
            <ul>
              {results.map((food) => (
                <FoodListItem key={food.id} food={food} onSelect={() => setSelectedFood(food)} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {recentFoods.length > 0 ? (
            <section aria-label="Recent foods">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recent
              </h2>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {recentFoods.map((item) => (
                  <button
                    key={item.food.id}
                    type="button"
                    aria-label={`Recent: ${item.food.name}`}
                    onClick={() => setSelectedFood(item.food)}
                    className="min-h-12 min-w-36 shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-left dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="block truncate text-sm font-medium">{item.food.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {formatKcal(item.food.kcal)} kcal
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {frequentFoods.length > 0 ? (
            <section aria-label="Frequent foods">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Frequent
              </h2>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {frequentFoods.map((item) => (
                  <button
                    key={item.food.id}
                    type="button"
                    aria-label={`Frequent: ${item.food.name}`}
                    onClick={() => setSelectedFood(item.food)}
                    className="min-h-12 min-w-36 shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-left dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="block truncate text-sm font-medium">{item.food.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      logged {item.count}×
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {meals.length > 0 ? (
            <section aria-label="My meals" className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="px-1 py-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                My meals
              </h2>
              <ul>
                {meals.map((customMeal) => (
                  <li key={customMeal.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMeal(customMeal)}
                      className="flex min-h-14 w-full items-center justify-between gap-2 border-t border-slate-200 px-1 py-2 text-left dark:border-slate-800"
                    >
                      <span>
                        <span className="block text-sm font-medium">{customMeal.name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {customMeal.items.length} items
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatKcal(totalForMeal(customMeal, foodById))} kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="All foods" className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="px-1 py-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              All foods
            </h2>
            <ul>
              {results.map((food) => (
                <FoodListItem key={food.id} food={food} onSelect={() => setSelectedFood(food)} />
              ))}
            </ul>
          </section>
        </>
      )}

      {selectedFood ? (
        <FoodSheet
          key={selectedFood.id}
          food={selectedFood}
          meal={meal}
          onClose={() => setSelectedFood(null)}
          onAdd={async (servings) => {
            await logFood(selectedFood, { date, meal }, servings);
            setSelectedFood(null);
            finish();
          }}
        />
      ) : null}

      {selectedMeal ? (
        <MealSheet
          key={selectedMeal.id}
          customMeal={selectedMeal}
          foodById={foodById}
          meal={meal}
          onClose={() => setSelectedMeal(null)}
          onLog={async () => {
            await logCustomMeal(selectedMeal, { date, meal });
            setSelectedMeal(null);
            finish();
          }}
        />
      ) : null}
    </div>
  );
}

function totalForMeal(meal: CustomMeal, foodById: Map<string, Food>): number {
  return meal.items.reduce((sum, item) => {
    const food = foodById.get(item.foodId);
    return food ? sum + food.kcal * item.servings : sum;
  }, 0);
}

function FoodSheet({
  food,
  meal,
  onClose,
  onAdd,
}: {
  food: Food;
  meal: Meal;
  onClose: () => void;
  onAdd: (servings: number) => Promise<void>;
}) {
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);
  const totals = scaleNutrition(snapshotFromFood(food), servings);

  return (
    <Sheet open title={food.name} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {food.servingLabel} · {formatKcal(food.kcal)} kcal
        </p>
        <FoodBadges food={food} />
      </div>

      {food.altServings.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Quick portions</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {food.altServings.map((alt) => {
              const altServings = roundServings(alt.grams / food.servingGrams);
              return (
                <button
                  key={alt.label}
                  type="button"
                  aria-pressed={servings === altServings}
                  onClick={() => setServings(altServings)}
                  className={`min-h-12 rounded-xl border px-3 text-xs font-medium ${
                    servings === altServings
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {alt.label} · {alt.grams} g
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Portion gram weights are estimates.
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <Stepper value={servings} onChange={setServings} label="Servings" />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-800">
        <div>
          <p className="text-sm font-bold tabular-nums">{formatKcal(totals.kcal)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">kcal</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums">{formatKcal(totals.proteinG)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">protein</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums">{formatKcal(totals.carbsG)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">carbs</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums">{formatKcal(totals.fatG)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">fat</p>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          void onAdd(servings);
        }}
        className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
      >
        Add to {MEAL_LABELS[meal]}
      </button>
    </Sheet>
  );
}

function MealSheet({
  customMeal,
  foodById,
  meal,
  onClose,
  onLog,
}: {
  customMeal: CustomMeal;
  foodById: Map<string, Food>;
  meal: Meal;
  onClose: () => void;
  onLog: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const missingCount = customMeal.items.filter((item) => !foodById.has(item.foodId)).length;

  return (
    <Sheet open title={customMeal.name} onClose={onClose}>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {customMeal.items.map((item) => {
          const food = foodById.get(item.foodId);
          return (
            <li key={`${item.foodId}-${item.servings}`} className="flex justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{food?.name ?? 'Missing food'}</span>
                {food ? null : (
                  <span className="block text-xs font-medium text-rose-600 dark:text-rose-400">
                    food no longer exists
                  </span>
                )}
              </span>
              <span className="shrink-0 text-slate-500 dark:text-slate-400">
                {item.servings}× · {formatKcal((food?.kcal ?? 0) * item.servings)} kcal
              </span>
            </li>
          );
        })}
      </ul>

      {missingCount > 0 ? (
        <p
          role="status"
          className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {missingCount} item(s) skipped: food no longer exists
        </p>
      ) : null}

      <p className="mt-2 text-sm font-semibold">
        Total {formatKcal(totalForMeal(customMeal, foodById))} kcal
      </p>

      <button
        type="button"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          void onLog();
        }}
        className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
      >
        Log meal to {MEAL_LABELS[meal]}
      </button>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Logging expands the meal into {customMeal.items.length} separate entries.
      </p>
    </Sheet>
  );
}
