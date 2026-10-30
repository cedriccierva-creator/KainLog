import type { ActivityLevel, GoalType, Sex } from '../types';

/** Standard Mifflin-St Jeor activity multipliers. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'veryActive',
];

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — little or no exercise',
  light: 'Lightly active — 1-3 days/week',
  moderate: 'Moderately active — 3-5 days/week',
  active: 'Very active — 6-7 days/week',
  veryActive: 'Extra active — physical job or 2× training',
};

export const GOAL_TYPES: readonly GoalType[] = ['lose', 'maintain', 'gain'];

export const GOAL_LABELS: Record<GoalType, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
};

export const SEX_LABELS: Record<Sex, string> = { female: 'Female', male: 'Male' };

/**
 * Conservative adult floors. Below these a self-calculated target stops being
 * sensible, so the suggestion never goes lower. Not medical advice.
 */
export const KCAL_FLOORS: Record<Sex, number> = { female: 1200, male: 1500 };

/** The suggested target never cuts more than this, or adds more than the surplus cap. */
export const MAX_DEFICIT_KCAL = 500;
export const MAX_SURPLUS_KCAL = 300;

/** Warn (don't block) when 4P+4C+9F drifts from the kcal target by more than 2%. */
export const MACRO_TOLERANCE = 0.02;

export const PROFILE_LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
  kcalTarget: { min: 1000, max: 6000 },
  macroG: { min: 0, max: 1000 },
} as const;

export interface BodyStats {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface GoalInput extends BodyStats {
  goalType: GoalType;
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ProfileDraft extends GoalInput {
  kcalTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function mifflinStJeorBmr(stats: BodyStats): number {
  const base = 10 * stats.weightKg + 6.25 * stats.heightCm - 5 * stats.age;
  return base + (stats.sex === 'male' ? 5 : -161);
}

/** BMR × activity multiplier (kcal/day). */
export function totalDailyEnergyExpenditure(stats: BodyStats): number {
  return mifflinStJeorBmr(stats) * ACTIVITY_FACTORS[stats.activityLevel];
}

/**
 * Suggested daily kcal: maintenance ± the goal delta, capped and floored,
 * rounded to the nearest 10. Estimate for adults only.
 */
export function suggestedKcal(input: GoalInput): number {
  const maintenance = totalDailyEnergyExpenditure(input);
  const delta =
    input.goalType === 'lose'
      ? -MAX_DEFICIT_KCAL
      : input.goalType === 'gain'
        ? MAX_SURPLUS_KCAL
        : 0;

  const bounded = Math.max(KCAL_FLOORS[input.sex], maintenance + delta);
  return Math.round(bounded / 10) * 10;
}

/** Default macros: ~1.6 g/kg protein, ~25% of kcal from fat, carbs take the rest. */
export function defaultMacros(kcalTarget: number, weightKg: number): MacroTargets {
  const proteinG = Math.round(1.6 * weightKg);
  const fatG = Math.round((kcalTarget * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcalTarget - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, carbsG, fatG };
}

export function macroKcal(macros: MacroTargets): number {
  return 4 * macros.proteinG + 4 * macros.carbsG + 9 * macros.fatG;
}

/** Fractional gap between the macro-derived energy and the kcal target. */
export function macroDeviation(kcalTarget: number, macros: MacroTargets): number {
  if (kcalTarget <= 0) return 0;
  return Math.abs(macroKcal(macros) - kcalTarget) / kcalTarget;
}

export function macrosWithinTolerance(kcalTarget: number, macros: MacroTargets): boolean {
  return macroDeviation(kcalTarget, macros) <= MACRO_TOLERANCE;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Human-readable validation messages (empty array = valid). */
export function validateProfileDraft(draft: ProfileDraft): string[] {
  const errors: string[] = [];
  const { age, heightCm, weightKg, kcalTarget, proteinG, carbsG, fatG } = draft;

  if (!inRange(age, PROFILE_LIMITS.age.min, PROFILE_LIMITS.age.max)) {
    errors.push(`Age must be between ${PROFILE_LIMITS.age.min} and ${PROFILE_LIMITS.age.max}.`);
  }
  if (!inRange(heightCm, PROFILE_LIMITS.heightCm.min, PROFILE_LIMITS.heightCm.max)) {
    errors.push(
      `Height must be between ${PROFILE_LIMITS.heightCm.min} and ${PROFILE_LIMITS.heightCm.max} cm.`,
    );
  }
  if (!inRange(weightKg, PROFILE_LIMITS.weightKg.min, PROFILE_LIMITS.weightKg.max)) {
    errors.push(
      `Weight must be between ${PROFILE_LIMITS.weightKg.min} and ${PROFILE_LIMITS.weightKg.max} kg.`,
    );
  }
  if (!inRange(kcalTarget, PROFILE_LIMITS.kcalTarget.min, PROFILE_LIMITS.kcalTarget.max)) {
    errors.push(
      `Calorie target must be between ${PROFILE_LIMITS.kcalTarget.min} and ${PROFILE_LIMITS.kcalTarget.max} kcal.`,
    );
  }
  for (const [label, value] of [
    ['Protein', proteinG],
    ['Carbs', carbsG],
    ['Fat', fatG],
  ] as const) {
    if (!inRange(value, PROFILE_LIMITS.macroG.min, PROFILE_LIMITS.macroG.max)) {
      errors.push(`${label} must be between 0 and ${PROFILE_LIMITS.macroG.max} g.`);
    }
  }

  return errors;
}
