import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { META_PROFILE_PLACEHOLDER } from '../db/seed';
import { formatKcal } from '../lib/format';

export default function ProfileScreen() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const isPlaceholder = useLiveQuery(
    async () => (await db.meta.get(META_PROFILE_PLACEHOLDER))?.value === true,
    [],
  );

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isPlaceholder ? 'Using placeholder goals' : 'Your goals'}
        </p>
      </header>

      {profile ? (
        <section
          aria-label="Current targets"
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current target
          </h2>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatKcal(profile.kcalTarget)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">kcal per day</p>
          <p className="mt-3 text-sm">
            {formatKcal(profile.proteinG)} g protein · {formatKcal(profile.carbsG)} g carbs ·{' '}
            {formatKcal(profile.fatG)} g fat
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Coming in Phase 3
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Stats form and Mifflin-St Jeor TDEE</li>
          <li>Suggested calorie target with manual override</li>
          <li>Export and import a JSON backup</li>
          <li>Dark mode switch</li>
        </ul>
      </section>
    </div>
  );
}
