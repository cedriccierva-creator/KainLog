import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { SEED_VERSION } from './db/seed';
import { FOOD_CATEGORIES } from './types';

/**
 * Phase 1 foundation check: proves the seeded, offline database is readable
 * through useLiveQuery on this device. Real screens replace this in Phase 2.
 */
export default function App() {
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const profile = useLiveQuery(() => db.profile.get('me'), []);

  const counts = new Map<string, number>();
  for (const food of foods ?? []) {
    counts.set(food.category, (counts.get(food.category) ?? 0) + 1);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">KainLog</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Offline Filipino food &amp; calorie log
        </p>
      </header>

      <section
        aria-label="Database status"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Local library
        </h2>
        {foods === undefined ? (
          <p className="mt-2 text-sm">Opening the local database…</p>
        ) : (
          <>
            <p className="mt-2 text-3xl font-bold">
              {foods.length} <span className="text-base font-medium">foods</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Stored in IndexedDB on this device · seed version {SEED_VERSION}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {FOOD_CATEGORIES.map((category) => (
                <li key={category} className="flex justify-between gap-2 capitalize">
                  <span className="text-slate-600 dark:text-slate-300">
                    {category.replace(/-/g, ' ')}
                  </span>
                  <span className="font-semibold tabular-nums">{counts.get(category) ?? 0}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section
        aria-label="Profile status"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Profile
        </h2>
        {profile ? (
          <p className="mt-2 text-sm">
            Target {profile.kcalTarget} kcal · {profile.proteinG} g protein ·{' '}
            {profile.carbsG} g carbs · {profile.fatG} g fat
          </p>
        ) : (
          <p className="mt-2 text-sm">No profile yet.</p>
        )}
      </section>

      <p className="pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Phase 1 foundation. Diary, Add Food, Progress and Profile screens arrive in the next phases.
      </p>
    </main>
  );
}
