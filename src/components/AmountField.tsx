import { Stepper } from './ui';
import type { AmountMode } from '../types';

/**
 * Amount entry with a Servings | Grams switch.
 *
 * The parent owns servings/grams text so it can persist exact values: grams are
 * converted to servings on every valid keystroke, and switching modes converts
 * the current amount instead of resetting it.
 */
export function AmountField({
  servings,
  servingGrams,
  mode,
  gramsText,
  gramsError,
  onModeChange,
  onServingsChange,
  onGramsTextChange,
  label = 'Servings',
}: {
  servings: number;
  /** Undefined for entries logged before grams support: servings only, no guessing. */
  servingGrams?: number;
  mode: AmountMode;
  gramsText: string;
  gramsError?: string;
  onModeChange: (mode: AmountMode) => void;
  onServingsChange: (servings: number) => void;
  onGramsTextChange: (text: string) => void;
  label?: string;
}) {
  const showGrams = mode === 'grams' && servingGrams !== undefined;

  return (
    <div>
      {servingGrams !== undefined ? (
        <div
          role="group"
          aria-label="Amount unit"
          className="mb-3 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
        >
          <button
            type="button"
            aria-pressed={mode === 'servings'}
            onClick={() => onModeChange('servings')}
            className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
              mode === 'servings'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Servings
          </button>
          <button
            type="button"
            aria-pressed={mode === 'grams'}
            onClick={() => onModeChange('grams')}
            className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
              mode === 'grams'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Grams
          </button>
        </div>
      ) : null}

      {showGrams ? (
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Grams</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.1"
            max="10000"
            step="any"
            value={gramsText}
            onChange={(event) => onGramsTextChange(event.target.value)}
            aria-label="Amount in grams"
            aria-invalid={gramsError ? true : undefined}
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-900"
          />
          {gramsError ? (
            <span className="mt-0.5 block text-xs font-medium text-rose-600 dark:text-rose-400">
              {gramsError}
            </span>
          ) : null}
        </label>
      ) : (
        <Stepper value={servings} onChange={onServingsChange} label={label} />
      )}
    </div>
  );
}
