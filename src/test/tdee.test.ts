import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FACTORS,
  KCAL_FLOORS,
  MAX_DEFICIT_KCAL,
  MAX_SURPLUS_KCAL,
  defaultMacros,
  macroDeviation,
  macroKcal,
  macrosWithinTolerance,
  mifflinStJeorBmr,
  suggestedKcal,
  totalDailyEnergyExpenditure,
  validateProfileDraft,
  type ProfileDraft,
} from '../lib/tdee';

/**
 * Hand-computed expectations:
 * male 30y / 175cm / 70kg, moderate (1.55):
 *   BMR  = 10×70 + 6.25×175 − 5×30 + 5 = 700 + 1093.75 − 150 + 5 = 1648.75
 *   TDEE = 1648.75 × 1.55 = 2555.5625
 */
const adultMale = {
  sex: 'male' as const,
  age: 30,
  heightCm: 175,
  weightKg: 70,
  activityLevel: 'moderate' as const,
};

/**
 * female 40y / 160cm / 60kg, sedentary (1.2):
 *   BMR  = 600 + 1000 − 200 − 161 = 1239
 *   TDEE = 1239 × 1.2 = 1486.8
 */
const adultFemale = {
  sex: 'female' as const,
  age: 40,
  heightCm: 160,
  weightKg: 60,
  activityLevel: 'sedentary' as const,
};

const validDraft: ProfileDraft = {
  ...adultMale,
  goalType: 'lose',
  kcalTarget: 2060,
  proteinG: 112,
  carbsG: 275,
  fatG: 57,
};

describe('Mifflin-St Jeor', () => {
  it('matches the hand-computed male BMR', () => {
    expect(mifflinStJeorBmr(adultMale)).toBeCloseTo(1648.75, 6);
  });

  it('matches the hand-computed female BMR', () => {
    expect(mifflinStJeorBmr(adultFemale)).toBeCloseTo(1239, 6);
  });

  it('applies the standard activity multipliers', () => {
    expect(ACTIVITY_FACTORS).toEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9,
    });
    expect(totalDailyEnergyExpenditure(adultMale)).toBeCloseTo(2555.5625, 6);
    expect(totalDailyEnergyExpenditure(adultFemale)).toBeCloseTo(1486.8, 6);
  });
});

describe('suggestedKcal', () => {
  it('subtracts the capped 500 kcal deficit for a lose goal', () => {
    // 2555.5625 − 500 = 2055.5625 → nearest 10 = 2060
    expect(suggestedKcal({ ...adultMale, goalType: 'lose' })).toBe(2060);
  });

  it('adds the capped 300 kcal surplus for a gain goal', () => {
    // male 25y / 180cm / 80kg, active (1.725): BMR = 800 + 1125 − 125 + 5 = 1805
    // TDEE = 3113.625; +300 = 3413.625 → 3410
    expect(
      suggestedKcal({
        sex: 'male',
        age: 25,
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'active',
        goalType: 'gain',
      }),
    ).toBe(3410);
  });

  it('returns maintenance for a maintain goal', () => {
    // 1239 × 1.2 = 1486.8 → 1490
    expect(suggestedKcal({ ...adultFemale, goalType: 'maintain' })).toBe(1490);
  });

  it('never suggests below the adult safety floor', () => {
    // 1486.8 − 500 = 986.8, floored to 1200
    expect(suggestedKcal({ ...adultFemale, goalType: 'lose' })).toBe(1200);
    expect(suggestedKcal({ ...adultFemale, goalType: 'lose' })).toBe(KCAL_FLOORS.female);
  });

  it('uses the documented cap constants', () => {
    expect(MAX_DEFICIT_KCAL).toBe(500);
    expect(MAX_SURPLUS_KCAL).toBe(300);
  });
});

describe('default macros', () => {
  it('uses ~1.6 g/kg protein, 25% fat and the rest from carbs', () => {
    // 1.6 × 70 = 112 protein; 0.25 × 2060 / 9 = 57.22 → 57 fat;
    // (2060 − 448 − 513) / 4 = 274.75 → 275 carbs
    expect(defaultMacros(2060, 70)).toEqual({ proteinG: 112, carbsG: 275, fatG: 57 });
  });

  it('lands within 2% of the kcal target', () => {
    const macros = defaultMacros(2060, 70);
    expect(macroKcal(macros)).toBe(2061);
    expect(macroDeviation(2060, macros)).toBeLessThan(0.02);
    expect(macrosWithinTolerance(2060, macros)).toBe(true);
  });

  it('warns when macros drift more than 2% from the target', () => {
    const macros = { proteinG: 100, carbsG: 250, fatG: 60 }; // 1940 kcal vs 2000
    expect(macroDeviation(2000, macros)).toBeCloseTo(0.03, 6);
    expect(macrosWithinTolerance(2000, macros)).toBe(false);
  });
});

describe('validateProfileDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateProfileDraft(validDraft)).toEqual([]);
  });

  it('rejects out-of-range stats', () => {
    const errors = validateProfileDraft({
      ...validDraft,
      age: 12,
      heightCm: 300,
      weightKg: 5,
      kcalTarget: 100,
      proteinG: -1,
    });
    expect(errors).toHaveLength(5);
    expect(errors.join(' ')).toMatch(/Age must be between 18 and 100/);
    expect(errors.join(' ')).toMatch(/Height must be between 120 and 230/);
    expect(errors.join(' ')).toMatch(/Weight must be between 30 and 300/);
    expect(errors.join(' ')).toMatch(/Calorie target must be between 1000 and 6000/);
    expect(errors.join(' ')).toMatch(/Protein must be between 0 and 1000/);
  });
});
