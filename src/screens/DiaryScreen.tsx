import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalorieRing, MacroBar, Sheet, Stepper } from '../components/ui';
import { db } from '../db/db';
import { deleteEntry, logFood, updateEntryServings } from '../db/logActions';
import { getDayEntries, getRecentFoods, type RecentFood } from '../db/queries';
import { META_PROFILE_PLACEHOLDER } from '../db/seed';
import { addDays, formatDayLabel, isToday, todayKey } from '../lib/date';
import { formatKcal, formatServings } from '../lib/format';
import { MEAL_LABELS, MEAL_ORDER } from '../lib/meals';
import { entryNutrition, sumNutrition } from '../lib/nutrition';
import type { LogEntry, Meal } from '../types';

export default function DiaryScreen() {
  const [searchParams] = useSearchParams();
  // The date is local-device state; Add Food can hand a date back through the query string.
  const [date, setDate] = useState(() => searchParams.get('date') ?? todayKey());

  const entries = useLiveQuery(() => getDayEntries(date), [date]);
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const isPlaceholder = useLiveQuery(
    async () => (await db.meta.get(META_PROFILE_PLACEHOLDER))?.value === true,
    [],
  );
  const recent = useLiveQuery(() => getRecentFoods(6), []);

  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [relogging, setRelogging] = useState<RecentFood | null>(null);

  const dayEntries = entries ?? [];
  const recentFoods = recent ?? [];
  const totals = sumNutrition(dayEntries.map(entryNutrition));
  const target = profile?.kcalTarget ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">KainLog</h1>
          {isToday(date) ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Today
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setDate(todayKey())}
              className="min-h-12 rounded-xl px-3 text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              Jump to today
            </button>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
            className="h-12 w-12 rounded-xl border border-slate-200 bg-white text-lg dark:border-slate-800 dark:bg-slate-900"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{formatDayLabel(date)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{date}</p>
          </div>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => setDate(addDays(date, 1))}
            className="h-12 w-12 rounded-xl border border-slate-200 bg-white text-lg dark:border-slate-800 dark:bg-slate-900"
          >
            ›
          </button>
        </div>
      </header>

      {isPlaceholder ? (
        <Link
          to="/profile"
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10"
        >
          <span>
            <span className="block text-sm font-semibold text-amber-900 dark:text-amber-200">
              Set your goals
            </span>
            <span className="block text-xs text-amber-800 dark:text-amber-300">
              Currently using a placeholder 2000 kcal target
            </span>
          </span>
          <span aria-hidden="true" className="text-lg text-amber-700 dark:text-amber-300">
            ›
          </span>
        </Link>
      ) : null}

      <section
        aria-label="Calories and macros"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <CalorieRing consumed={totals.kcal} target={target} />
        <div className="mt-4 grid gap-3">
          <MacroBar label="Protein" consumed={totals.proteinG} target={profile?.proteinG ?? 0} />
          <MacroBar label="Carbs" consumed={totals.carbsG} target={profile?.carbsG ?? 0} />
          <MacroBar label="Fat" consumed={totals.fatG} target={profile?.fatG ?? 0} />
        </div>
      </section>

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
                aria-label={`Log again: ${item.food.name}`}
                onClick={() => setRelogging(item)}
                className="min-h-12 min-w-36 shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-left dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="block truncate text-sm font-medium">{item.food.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {formatKcal(item.food.kcal)} kcal · {formatServings(item.servings)}×
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {MEAL_ORDER.map((meal) => {
        const mealEntries = dayEntries.filter((entry) => entry.meal === meal);
        const mealKcal = sumNutrition(mealEntries.map(entryNutrition)).kcal;

        return (
          <section
            key={meal}
            aria-label={MEAL_LABELS[meal]}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {MEAL_LABELS[meal]}
              </h2>
              <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {formatKcal(mealKcal)} kcal
              </span>
            </header>

            {mealEntries.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-400 dark:text-slate-500">Nothing logged</p>
            ) : (
              <ul className="mt-1">
                {mealEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-lg px-1 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {entry.snapshot.foodName}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {formatServings(entry.servings)} × {entry.snapshot.servingLabel}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatKcal(entryNutrition(entry).kcal)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.snapshot.foodName}`}
                      onClick={() => void deleteEntry(entry.id)}
                      className="h-12 w-12 shrink-0 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to={`/add?date=${date}&meal=${meal}`}
              aria-label={`Add food to ${MEAL_LABELS[meal]}`}
              className="mt-1 flex min-h-12 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              + Add food
            </Link>
          </section>
        );
      })}

      {editing ? (
        <EntrySheet key={editing.id} entry={editing} onClose={() => setEditing(null)} />
      ) : null}
      {relogging ? (
        <RelogSheet
          key={relogging.food.id}
          recent={relogging}
          date={date}
          onClose={() => setRelogging(null)}
        />
      ) : null}
    </div>
  );
}

function EntrySheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const [servings, setServings] = useState(entry.servings);
  const total = entryNutrition({ ...entry, servings });

  return (
    <Sheet open title={entry.snapshot.foodName} onClose={onClose}>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {entry.snapshot.servingLabel} · {formatKcal(entry.snapshot.kcal)} kcal per serving
      </p>

      <div className="mt-4">
        <Stepper value={servings} onChange={setServings} label="Servings" />
      </div>

      <p className="mt-4 text-center text-sm">
        <span className="text-lg font-semibold tabular-nums">{formatKcal(total.kcal)}</span> kcal ·{' '}
        {formatKcal(total.proteinG)} P · {formatKcal(total.carbsG)} C · {formatKcal(total.fatG)} F
      </p>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={() => {
            void updateEntryServings(entry.id, servings).then(onClose);
          }}
          className="min-h-12 rounded-xl bg-emerald-600 text-sm font-semibold text-white"
        >
          Save servings
        </button>
        <button
          type="button"
          onClick={() => {
            void deleteEntry(entry.id).then(onClose);
          }}
          className="min-h-12 rounded-xl border border-rose-300 text-sm font-semibold text-rose-600 dark:border-rose-500/40 dark:text-rose-400"
        >
          Delete entry
        </button>
      </div>
    </Sheet>
  );
}

function RelogSheet({
  recent,
  date,
  onClose,
}: {
  recent: RecentFood;
  date: string;
  onClose: () => void;
}) {
  const [servings, setServings] = useState(recent.servings);
  const [meal, setMeal] = useState<Meal>(recent.meal);

  return (
    <Sheet open title={recent.food.name} onClose={onClose}>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {recent.food.servingLabel} · {formatKcal(recent.food.kcal)} kcal per serving
      </p>

      <div className="mt-4">
        <Stepper value={servings} onChange={setServings} label="Servings" />
      </div>

      <label className="mt-4 block text-sm font-medium" htmlFor="relog-meal">
        Meal
      </label>
      <select
        id="relog-meal"
        value={meal}
        onChange={(event) => setMeal(event.target.value as Meal)}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        {MEAL_ORDER.map((option) => (
          <option key={option} value={option}>
            {MEAL_LABELS[option]}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          void logFood(recent.food, { date, meal }, servings).then(onClose);
        }}
        className="mt-5 min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white"
      >
        Add to {MEAL_LABELS[meal]}
      </button>
    </Sheet>
  );
}
