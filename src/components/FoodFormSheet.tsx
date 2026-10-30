import { useState, type ChangeEvent } from 'react';
import { createFood, updateFood, type FoodInput } from '../db/logActions';
import { CATEGORY_LABELS } from '../lib/categories';
import { FOOD_CATEGORIES, type Food, type FoodCategory } from '../types';
import { Sheet } from './ui';

interface FormState {
  name: string;
  aliases: string;
  category: FoodCategory;
  servingLabel: string;
  servingGrams: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  sodiumMg: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  aliases: '',
  category: 'ulam',
  servingLabel: '1 serving',
  servingGrams: '100',
  kcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
  sodiumMg: '',
  notes: '',
};

function initialForm(food: Food | null): FormState {
  if (!food) return EMPTY_FORM;
  return {
    name: food.name,
    aliases: food.aliases.join(', '),
    category: food.category,
    servingLabel: food.servingLabel,
    servingGrams: String(food.servingGrams),
    kcal: String(food.kcal),
    proteinG: String(food.proteinG),
    carbsG: String(food.carbsG),
    fatG: String(food.fatG),
    fiberG: food.fiberG === undefined ? '' : String(food.fiberG),
    sodiumMg: food.sodiumMg === undefined ? '' : String(food.sodiumMg),
    notes: food.notes ?? '',
  };
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        inputMode={type === 'number' ? 'decimal' : undefined}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.1' : undefined}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
      />
      {hint ? <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}

export default function FoodFormSheet({ food, onClose }: { food: Food | null; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(() => initialForm(food));
  const [saving, setSaving] = useState(false);

  const update =
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const toNumber = (value: string) => (value.trim() === '' ? 0 : Number(value));
  const optionalNumber = (value: string) =>
    value.trim() === '' ? undefined : Number(value);

  const numbers = {
    servingGrams: toNumber(form.servingGrams),
    kcal: toNumber(form.kcal),
    proteinG: toNumber(form.proteinG),
    carbsG: toNumber(form.carbsG),
    fatG: toNumber(form.fatG),
    fiberG: optionalNumber(form.fiberG),
    sodiumMg: optionalNumber(form.sodiumMg),
  };

  const isValid =
    form.name.trim().length > 0 &&
    form.servingLabel.trim().length > 0 &&
    Number.isFinite(numbers.servingGrams) &&
    numbers.servingGrams > 0 &&
    [numbers.kcal, numbers.proteinG, numbers.carbsG, numbers.fatG].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) &&
    [numbers.fiberG, numbers.sodiumMg].every(
      (value) => value === undefined || (Number.isFinite(value) && value >= 0),
    );

  async function save(): Promise<void> {
    if (!isValid || saving) return;
    setSaving(true);

    const input: FoodInput = {
      name: form.name.trim(),
      aliases: form.aliases
        .split(',')
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0),
      category: form.category,
      servingLabel: form.servingLabel.trim(),
      servingGrams: numbers.servingGrams,
      kcal: numbers.kcal,
      proteinG: numbers.proteinG,
      carbsG: numbers.carbsG,
      fatG: numbers.fatG,
      fiberG: numbers.fiberG,
      sodiumMg: numbers.sodiumMg,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (food) {
        await updateFood(food.id, input);
      } else {
        await createFood(input);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open title={food ? `Edit ${food.name}` : 'New food'} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Name" value={form.name} onChange={update('name')} />

        <Field
          label="Aliases"
          value={form.aliases}
          onChange={update('aliases')}
          hint="Comma-separated, e.g. adobong baboy, pork adobo"
        />

        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Category</span>
          <select
            value={form.category}
            onChange={update('category')}
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          >
            {FOOD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <Field label="Serving label" value={form.servingLabel} onChange={update('servingLabel')} />
        <Field
          label="Serving grams"
          type="number"
          value={form.servingGrams}
          onChange={update('servingGrams')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)" type="number" value={form.kcal} onChange={update('kcal')} />
          <Field label="Protein (g)" type="number" value={form.proteinG} onChange={update('proteinG')} />
          <Field label="Carbs (g)" type="number" value={form.carbsG} onChange={update('carbsG')} />
          <Field label="Fat (g)" type="number" value={form.fatG} onChange={update('fatG')} />
          <Field label="Fiber (g)" type="number" value={form.fiberG} onChange={update('fiberG')} />
          <Field label="Sodium (mg)" type="number" value={form.sodiumMg} onChange={update('sodiumMg')} />
        </div>

        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Notes</span>
          <textarea
            value={form.notes}
            onChange={update('notes')}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {food?.source === 'seed-estimate' ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Saving your own values changes this food&apos;s badge from estimate to custom. Past log
            entries keep their original values.
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isValid || saving}
          onClick={() => void save()}
          className="min-h-12 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save food
        </button>
      </div>
    </Sheet>
  );
}
