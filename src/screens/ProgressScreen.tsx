import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useTodayKey } from '../hooks/useTodayKey';
import { dateKeyToDate, formatDayLabel, lastNDays } from '../lib/date';
import { formatGrams, formatKcal } from '../lib/format';
import { movingAverage, summarizeDays, weightChange, type WeightPoint } from '../lib/weekly';
import { PROFILE_LIMITS } from '../lib/tdee';

const CARD =
  'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';

export default function ProgressScreen() {
  const today = useTodayKey();
  const dates = lastNDays(today, 7);

  const entries = useLiveQuery(
    () => db.logEntries.where('date').anyOf(dates).toArray(),
    [dates.join(',')],
  );
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const weights = useLiveQuery(() => db.weightEntries.orderBy('date').toArray(), []);

  const target = profile?.kcalTarget ?? 0;
  const summary = summarizeDays(dates, entries ?? []);
  const weightPoints = movingAverage(weights ?? []);

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Progress</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Last 7 days, local time.</p>
      </header>

      <section aria-label="Weekly calories" className={CARD}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Calories vs target
        </h2>

        {target > 0 ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" data-testid="week-average">
            {summary.averageKcal === null
              ? 'No data yet this week.'
              : `Average ${formatKcal(summary.averageKcal)} kcal on ${summary.daysWithData} logged ${
                  summary.daysWithData === 1 ? 'day' : 'days'
                } · target ${formatKcal(target)} kcal`}
          </p>
        ) : null}

        <div className="relative mt-4 h-24">
          {target > 0 ? <TargetLine target={target} days={summary.days} /> : null}
          <div className="flex h-full items-end gap-1.5">
            {summary.days.map((day) => (
              <div key={day.date} className="flex h-full flex-1 items-end">
                {day.kcal === null ? (
                  <div
                    aria-label={`${formatDayLabel(day.date)}: no data`}
                    className="h-0.5 w-full rounded-full bg-slate-300 dark:bg-slate-700"
                  />
                ) : (
                  <div
                    aria-label={`${formatDayLabel(day.date)}: ${formatKcal(day.kcal)} kcal`}
                    className={`w-full rounded-t-md ${
                      target > 0 && day.kcal > target
                        ? 'bg-amber-500'
                        : 'bg-emerald-600 dark:bg-emerald-500'
                    }`}
                    style={{
                      height: `${barHeight(day.kcal, maxOf(summary.days.map((d) => d.kcal), target))}%`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 flex gap-1.5">
          {summary.days.map((day) => (
            <div key={day.date} className="flex-1 text-center">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(
                  dateKeyToDate(day.date),
                )}
              </div>
              <div className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                {day.kcal === null ? 'no data' : formatKcal(day.kcal)}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          Dashed line = target. Days with nothing logged are shown as “no data” and left out of the
          average.
        </p>
      </section>

      <WeightSection points={weightPoints} />

      <section aria-label="Weight history" className={CARD}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Weigh-ins
        </h2>
        {weightPoints.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No weigh-ins yet. One entry per day; logging again replaces that day.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {[...weightPoints].reverse().slice(0, 10).map((point) => (
              <li key={point.date} className="flex items-center justify-between gap-2 py-2">
                <span className="text-slate-600 dark:text-slate-300">
                  {formatDayLabel(point.date)}
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span>{formatGrams(point.kg)} kg</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    7-day {formatGrams(point.movingAverage)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete weigh-in for ${formatDayLabel(point.date)}`}
                    onClick={() => void db.weightEntries.delete(point.date)}
                    className="min-h-11 min-w-11 rounded-lg text-xs text-rose-600 dark:text-rose-400"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function barHeight(kcal: number, max: number): number {
  return Math.max(4, (kcal / max) * 100);
}

function maxOf(values: (number | null)[], fallback: number): number {
  return Math.max(fallback, ...values.filter((value): value is number => value !== null), 1);
}

/** The dashed target marker, drawn once across the whole bar area. */
function TargetLine({ target, days }: { target: number; days: { kcal: number | null }[] }) {
  const max = maxOf(days.map((day) => day.kcal), target);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 flex items-center"
      style={{ bottom: `${Math.min(100, (target / max) * 100)}%` }}
    >
      <div className="w-full border-t border-dashed border-emerald-600/70 dark:border-emerald-400/70" />
    </div>
  );
}

function WeightSection({ points }: { points: WeightPoint[] }) {
  const today = useTodayKey();
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const parsed = Number(kg);
  const isValid =
    kg.trim() !== '' &&
    Number.isFinite(parsed) &&
    parsed >= PROFILE_LIMITS.weightKg.min &&
    parsed <= PROFILE_LIMITS.weightKg.max;
  const change = weightChange(points);

  async function save(): Promise<void> {
    if (!isValid) return;
    await db.weightEntries.put({ date, kg: Math.round(parsed * 10) / 10 });
    setKg('');
    setMessage('Saved.');
  }

  return (
    <section aria-label="Weight log" className={CARD}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Weight
      </h2>

      <div className="mt-2 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Weight (kg)
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            min={PROFILE_LIMITS.weightKg.min}
            max={PROFILE_LIMITS.weightKg.max}
            value={kg}
            onChange={(event) => {
              setKg(event.target.value);
              setMessage(null);
            }}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base tabular-nums dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!isValid}
          className="min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950"
        >
          Log weight
        </button>
        {message ? (
          <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
      </div>

      {points.length >= 2 ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">Trend (7-day average)</p>
            <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {change !== null && change !== 0
                ? `${change > 0 ? '+' : ''}${formatGrams(change)} kg since first`
                : 'No change yet'}
            </p>
          </div>
          <WeightChart points={points.slice(-30)} />
        </div>
      ) : null}
    </section>
  );
}

function WeightChart({ points }: { points: WeightPoint[] }) {
  const width = 320;
  const height = 140;
  const pad = 10;
  const values = points.flatMap((point) => [point.kg, point.movingAverage]);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;

  const x = (index: number): number =>
    pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const y = (value: number): number =>
    height - pad - ((value - min) / Math.max(max - min, 0.1)) * (height - pad * 2);

  const raw = points.map((point, index) => `${x(index)},${y(point.kg)}`).join(' ');
  const average = points.map((point, index) => `${x(index)},${y(point.movingAverage)}`).join(' ');

  return (
    <figure className="mt-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Weight trend with a 7-day moving average"
        className="h-auto w-full"
      >
        <polyline
          points={raw}
          fill="none"
          strokeWidth="1"
          className="stroke-slate-300 dark:stroke-slate-700"
        />
        <polyline
          points={average}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-emerald-600 dark:stroke-emerald-400"
        />
        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.kg)}
            r="2.5"
            className="fill-slate-400 dark:fill-slate-500"
          />
        ))}
        <text x={pad} y={pad + 4} fontSize="9" className="fill-slate-400">
          {formatGrams(max - 1)} kg
        </text>
        <text x={pad} y={height - 2} fontSize="9" className="fill-slate-400">
          {formatGrams(min + 1)} kg
        </text>
      </svg>
      <figcaption className="text-[10px] text-slate-500 dark:text-slate-400">
        Thin line = individual weigh-ins. Green = 7-day moving average.
      </figcaption>
    </figure>
  );
}
