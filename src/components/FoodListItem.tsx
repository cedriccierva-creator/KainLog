import type { Food } from '../types';
import { formatKcal } from '../lib/format';
import { FoodBadges } from './ui';

export default function FoodListItem({
  food,
  onSelect,
  detail,
}: {
  food: Food;
  onSelect: () => void;
  detail?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-14 w-full flex-col justify-center gap-0.5 border-b border-slate-200 px-1 py-2 text-left last:border-0 dark:border-slate-800"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{food.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatKcal(food.kcal)} kcal
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">{detail ?? food.servingLabel}</span>
          <FoodBadges food={food} />
        </span>
      </button>
    </li>
  );
}
