import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { META_PROFILE_PLACEHOLDER } from '../db/seed';
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  GOAL_LABELS,
  GOAL_TYPES,
  KCAL_FLOORS,
  MACRO_TOLERANCE,
  PROFILE_LIMITS,
  SEX_LABELS,
  defaultMacros,
  macroDeviation,
  macroKcal,
  mifflinStJeorBmr,
  suggestedKcal,
  totalDailyEnergyExpenditure,
  validateProfileDraft,
  type ProfileDraft,
} from '../lib/tdee';
import { formatKcal } from '../lib/format';
import { applyTheme, readStoredTheme, resolveTheme, setStoredTheme } from '../lib/theme';
import { buildBackup, downloadBackup, parseBackup, applyBackup, type BackupFile } from '../db/backup';
import { Sheet } from '../components/ui';
import type { ActivityLevel, GoalType, Profile, Sex } from '../types';

const CARD =
  'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';

export default function ProfileScreen() {
  const [formRevision, setFormRevision] = useState(0);
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
        <ProfileForm
          key={formRevision}
          profile={profile}
          isPlaceholder={isPlaceholder ?? false}
        />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile…</p>
      )}

      <BackupSection onDataReplaced={() => setFormRevision((revision) => revision + 1)} />
      <AppearanceSection />
    </div>
  );
}

function ProfileForm({ profile, isPlaceholder }: { profile: Profile; isPlaceholder: boolean }) {
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [age, setAge] = useState(String(profile.age));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  const [weightKg, setWeightKg] = useState(String(profile.weightKg));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel);
  const [goalType, setGoalType] = useState<GoalType>(profile.goalType);
  const [kcalTarget, setKcalTarget] = useState(String(profile.kcalTarget));
  const [proteinG, setProteinG] = useState(String(profile.proteinG));
  const [carbsG, setCarbsG] = useState(String(profile.carbsG));
  const [fatG, setFatG] = useState(String(profile.fatG));
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const body = {
    sex,
    age: Number(age),
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    activityLevel,
  };
  const draft: ProfileDraft = {
    ...body,
    goalType,
    kcalTarget: Number(kcalTarget),
    proteinG: Number(proteinG),
    carbsG: Number(carbsG),
    fatG: Number(fatG),
  };
  const errors = validateProfileDraft(draft);
  const isValid = errors.length === 0;

  const bmr = mifflinStJeorBmr(body);
  const maintenance = totalDailyEnergyExpenditure(body);
  const suggestion = suggestedKcal({ ...body, goalType });
  const macros = { proteinG: draft.proteinG, carbsG: draft.carbsG, fatG: draft.fatG };
  const deviation = macroDeviation(draft.kcalTarget, macros);
  const showMacroWarning = isValid && deviation > MACRO_TOLERANCE;
  const belowSafetyFloor =
    Number.isFinite(draft.kcalTarget) && draft.kcalTarget > 0 && draft.kcalTarget < KCAL_FLOORS[sex];

  function applyDefaultMacros(kcal: number): void {
    const macrosForTarget = defaultMacros(kcal, Number.isFinite(body.weightKg) ? body.weightKg : profile.weightKg);
    setProteinG(String(macrosForTarget.proteinG));
    setCarbsG(String(macrosForTarget.carbsG));
    setFatG(String(macrosForTarget.fatG));
  }

  function useSuggestion(): void {
    setKcalTarget(String(suggestion));
    applyDefaultMacros(suggestion);
    setStatus(null);
  }

  async function save(): Promise<void> {
    if (!isValid || isSaving) return;
    setIsSaving(true);
    try {
      await db.transaction('rw', [db.profile, db.meta], async () => {
        await db.profile.put({ id: 'me', ...draft });
        await db.meta.put({ key: META_PROFILE_PLACEHOLDER, value: false });
      });
      setStatus('Goals saved.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {isPlaceholder ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          These are placeholder goals. Fill in your stats and save to start tracking against your
          own targets.
        </p>
      ) : null}

      <section aria-label="About you" className={CARD}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          About you
        </h2>

        <fieldset className="mb-3">
          <legend className="mb-1 text-sm text-slate-600 dark:text-slate-300">Sex</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['female', 'male'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={sex === option}
                onClick={() => setSex(option)}
                className={`min-h-11 rounded-xl border text-sm font-medium ${
                  sex === option
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {SEX_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <NumberField id="age" label="Age" unit="years" value={age} onChange={setAge} {...PROFILE_LIMITS.age} />
          <NumberField
            id="height"
            label="Height"
            unit="cm"
            value={heightCm}
            onChange={setHeightCm}
            {...PROFILE_LIMITS.heightCm}
          />
          <NumberField
            id="weight"
            label="Weight"
            unit="kg"
            step={0.1}
            value={weightKg}
            onChange={setWeightKg}
            {...PROFILE_LIMITS.weightKg}
          />
          <label className="col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Activity level</span>
            <select
              id="activity"
              value={activityLevel}
              onChange={(event) => setActivityLevel(event.target.value as ActivityLevel)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {ACTIVITY_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section aria-label="Goal" className={CARD}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Goal
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {GOAL_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={goalType === option}
              onClick={() => setGoalType(option)}
              className={`min-h-11 rounded-xl border px-2 text-sm font-medium ${
                goalType === option
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              {GOAL_LABELS[option]}
            </button>
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">BMR (Mifflin-St Jeor)</dt>
            <dd className="tabular-nums">{formatKcal(bmr)} kcal</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Maintenance</dt>
            <dd className="tabular-nums">{formatKcal(maintenance)} kcal</dd>
          </div>
        </dl>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
          <p className="text-xs text-slate-500 dark:text-slate-400">Suggested target</p>
          <p className="text-2xl font-bold tabular-nums" data-testid="suggested-kcal">
            {formatKcal(suggestion)} kcal
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estimate for adults. Deficit capped at 500 kcal, surplus at 300 kcal, with an adult
            safety floor. Not medical advice.
          </p>
          <button
            type="button"
            onClick={useSuggestion}
            disabled={!isValid}
            className="mt-2 min-h-11 w-full rounded-xl border border-emerald-600 text-sm font-semibold text-emerald-700 disabled:opacity-50 dark:border-emerald-400 dark:text-emerald-300"
          >
            Use suggestion + default macros
          </button>
        </div>

        <div className="mt-3">
          <NumberField
            id="kcal"
            label="Daily calorie target"
            unit="kcal"
            value={kcalTarget}
            onChange={setKcalTarget}
            {...PROFILE_LIMITS.kcalTarget}
          />
          {belowSafetyFloor ? (
            <p
              role="alert"
              data-testid="floor-warning"
              className="mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              Below the adult safety floor of {KCAL_FLOORS[sex]} kcal for your selected sex. You can
              still save it, but targets this low are usually only appropriate with medical
              supervision.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-label="Macros" className={CARD}>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Macros
        </h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Defaults: {formatKcal(macroKcal(macros))} kcal from macros vs {formatKcal(draft.kcalTarget)}{' '}
          kcal target.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            id="protein"
            label="Protein"
            unit="g"
            value={proteinG}
            onChange={setProteinG}
            {...PROFILE_LIMITS.macroG}
          />
          <NumberField
            id="carbs"
            label="Carbs"
            unit="g"
            value={carbsG}
            onChange={setCarbsG}
            {...PROFILE_LIMITS.macroG}
          />
          <NumberField
            id="fat"
            label="Fat"
            unit="g"
            value={fatG}
            onChange={setFatG}
            {...PROFILE_LIMITS.macroG}
          />
        </div>
        <button
          type="button"
          onClick={() => applyDefaultMacros(Number(kcalTarget))}
          disabled={!isValid}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
        >
          Reset macros from target
        </button>
        {showMacroWarning ? (
          <p
            role="alert"
            className="mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            Macros add up to {formatKcal(macroKcal(macros))} kcal, {Math.round(deviation * 100)}% off
            your {formatKcal(draft.kcalTarget)} kcal target. That is allowed, but double-check it.
          </p>
        ) : null}
      </section>

      {errors.length > 0 ? (
        <ul role="alert" className="space-y-1 rounded-2xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={!isValid || isSaving}
        className="min-h-12 rounded-2xl bg-emerald-600 text-base font-semibold text-white disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950"
      >
        {isSaving ? 'Saving…' : 'Save goals'}
      </button>
      {status ? (
        <p role="status" className="text-center text-sm text-emerald-700 dark:text-emerald-300">
          {status}
        </p>
      ) : null}
    </>
  );
}

function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="flex items-center gap-1">
        <input
          id={id}
          aria-label={label}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base tabular-nums dark:border-slate-700 dark:bg-slate-900"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Backup                                                              */
/* ------------------------------------------------------------------ */

function BackupSection({ onDataReplaced }: { onDataReplaced: () => void }) {
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function exportData(): Promise<void> {
    setError(null);
    setIsBusy(true);
    try {
      const backup = await buildBackup();
      const filename = downloadBackup(backup);
      setMessage(
        `Exported ${backup.tables.logEntries.length} entries to ${filename}.`,
      );
    } catch {
      setError('Export failed. Try again.');
    } finally {
      setIsBusy(false);
    }
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setMessage(null);
    setError(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setPending(null);
      setError(`Import rejected: ${result.error} Your data was not changed.`);
      return;
    }
    setPending(result.backup);
  }

  async function confirmImport(): Promise<void> {
    if (!pending) return;
    setIsBusy(true);
    try {
      await applyBackup(pending);
      setPending(null);
      setMessage('Import complete. All data was replaced.');
      onDataReplaced();
    } catch {
      setError('Import failed partway through. Reload and try again.');
    } finally {
      setIsBusy(false);
    }
  }

  const pendingCounts = pending
    ? `${pending.tables.logEntries.length} entries, ${pending.tables.foods.length} foods, ${pending.tables.weightEntries.length} weigh-ins`
    : '';

  return (
    <section aria-label="Backup" className={CARD}>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Backup
      </h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Everything lives on this device. Export a JSON file before changing phones or clearing
        browser data.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void exportData()}
          disabled={isBusy}
          className="min-h-11 rounded-xl border border-slate-300 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
        >
          Export data
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="min-h-11 rounded-xl border border-slate-300 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
        >
          Import data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Backup file"
          onChange={(event) => void pickFile(event)}
          className="hidden"
        />
      </div>

      {message ? (
        <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <Sheet open={pending !== null} title="Replace all data?" onClose={() => setPending(null)}>
        <p className="text-sm">
          This backup contains {pendingCounts}. Importing replaces every food, entry, meal, weigh-in
          and setting on this device. There is no undo.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="min-h-11 flex-1 rounded-xl border border-slate-300 text-sm font-semibold dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmImport()}
            disabled={isBusy}
            className="min-h-11 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            Replace all data
          </button>
        </div>
      </Sheet>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

function AppearanceSection() {
  const stored = useLiveQuery(() => readStoredTheme(), []);
  const theme = resolveTheme(stored);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  async function toggle(): Promise<void> {
    await setStoredTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <section aria-label="Appearance" className={CARD}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Appearance
      </h2>
      <button
        type="button"
        role="switch"
        aria-checked={theme === 'dark'}
        aria-label="Dark mode"
        onClick={() => void toggle()}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-sm"
      >
        <span>Dark mode</span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-emerald-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {stored ? 'Saved on this device.' : 'Following your system setting until you choose.'}
      </p>
    </section>
  );
}
