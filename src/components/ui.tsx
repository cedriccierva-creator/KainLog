import type { ReactNode } from 'react';
import { formatGrams, formatServings, targetPercent } from '../lib/format';
import { SERVING_STEP } from '../lib/nutrition';
import type { Food } from '../types';

type Tone = 'estimate' | 'custom' | 'hidden' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  estimate:
    'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  custom:
    'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  hidden:
    'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
  neutral:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

/** "estimate" for untouched seed rows, "custom" once the user's values are in play. */
export function FoodBadges({ food }: { food: Pick<Food, 'source' | 'hidden'> }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {food.source === 'seed-estimate' ? (
        <Badge tone="estimate">estimate</Badge>
      ) : (
        <Badge tone="custom">custom</Badge>
      )}
      {food.hidden ? <Badge tone="hidden">hidden</Badge> : null}
    </span>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop: mouse convenience only; the Close button is the accessible exit. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-xl dark:bg-slate-900 sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-2 min-h-12 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const step = (direction: 1 | -1) => onChange(Math.max(SERVING_STEP, value + direction * SERVING_STEP));

  return (
    <div aria-label={label} className="flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label={`Decrease servings: ${label}`}
        onClick={() => step(-1)}
        disabled={value <= SERVING_STEP}
        className="h-12 w-12 rounded-xl border border-slate-300 text-xl font-semibold disabled:opacity-40 dark:border-slate-700"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-16 text-center text-lg font-semibold tabular-nums">
        {formatServings(value)}
      </span>
      <button
        type="button"
        aria-label={`Increase servings: ${label}`}
        onClick={() => step(1)}
        className="h-12 w-12 rounded-xl border border-slate-300 text-xl font-semibold dark:border-slate-700"
      >
        +
      </button>
    </div>
  );
}

export function MacroBar({
  label,
  consumed,
  target,
}: {
  label: string;
  consumed: number;
  target: number;
}) {
  const percent = targetPercent(consumed, target);

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          {formatGrams(consumed)} / {target} g
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${Math.round(percent)}%` }}
        />
      </div>
    </div>
  );
}

export function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const remaining = target - consumed;
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const overTarget = remaining < 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            transform="rotate(-90 60 60)"
            className={overTarget ? 'stroke-rose-500' : 'stroke-emerald-500'}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{Math.round(Math.abs(remaining))}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {overTarget ? 'kcal over' : 'kcal left'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {Math.round(consumed)} eaten · {Math.round(target)} target
      </p>
    </div>
  );
}
