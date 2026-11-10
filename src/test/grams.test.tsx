// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MealFormSheet from '../components/MealFormSheet';
import { db } from '../db/db';
import { createFood, updateEntryServings } from '../db/logActions';
import { createLogEntry, servingsFromGrams } from '../lib/nutrition';
import { renderApp, resetDatabase } from './utils';

async function makeRiceFood(servingGrams = 100) {
  return createFood({
    name: 'Cooked white rice',
    aliases: ['white rice'],
    category: 'rice',
    servingLabel: `${servingGrams} g`,
    servingGrams,
    kcal: 130,
    proteinG: 2.7,
    carbsG: 28,
    fatG: 0.3,
  });
}

async function openRiceSheet() {
  const user = userEvent.setup();
  renderApp('/add?meal=lunch&date=2026-10-30');
  await user.type(await screen.findByLabelText('Search foods'), 'cooked white rice');
  await user.click(await screen.findByRole('button', { name: /Cooked white rice/ }));
  return {
    user,
    dialog: await screen.findByRole('dialog', { name: 'Cooked white rice' }),
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

describe('logging by grams', () => {
  it('opens in Grams for a bare gram label, previews live, and stores exact servings', async () => {
    const food = await makeRiceFood();
    const { user, dialog } = await openRiceSheet();

    expect(within(dialog).getByRole('button', { name: 'Grams' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    const gramsInput = within(dialog).getByLabelText('Amount in grams');
    expect((gramsInput as HTMLInputElement).value).toBe('100');

    await user.clear(gramsInput);
    await user.type(gramsInput, '167');

    // 130 kcal per 100 g × 1.67 = 217.1 → 217 on screen, full precision in the entry.
    expect(within(dialog).getByText('217')).toBeTruthy();
    expect(within(dialog).getByText('1.67 servings · 100 g per serving')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Add to Lunch' }));

    await waitFor(async () => expect(await db.logEntries.count()).toBe(1));
    const entry = (await db.logEntries.toArray())[0];
    expect(entry.foodId).toBe(food.id);
    expect(entry.servings).toBe(1.67);
    expect(entry.amountMode).toBe('grams');
    expect(entry.snapshot.servingGrams).toBe(100);

    // Diary row: total grams, not "1.67 × 100 g".
    expect(await screen.findByText('167 g')).toBeTruthy();
  });

  it('switching modes converts the current amount instead of resetting it', async () => {
    await makeRiceFood();
    const { user, dialog } = await openRiceSheet();

    await user.click(within(dialog).getByRole('button', { name: 'Servings' }));
    await user.click(within(dialog).getByRole('button', { name: 'Increase servings: Servings' }));
    await user.click(within(dialog).getByRole('button', { name: 'Grams' }));
    expect((within(dialog).getByLabelText('Amount in grams') as HTMLInputElement).value).toBe('125');
  });

  it('keeps an untouched grams entry at exactly 1.67 servings when saved', async () => {
    const user = userEvent.setup();
    const food = await makeRiceFood();
    const entry = createLogEntry(food, {
      date: '2026-10-30',
      meal: 'lunch',
      servings: servingsFromGrams(167, 100),
      amountMode: 'grams',
    });
    await db.logEntries.add(entry);

    renderApp('/?date=2026-10-30');
    await user.click(await screen.findByRole('button', { name: /Cooked white rice.*167 g/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Cooked white rice' });

    await user.click(within(dialog).getByRole('button', { name: 'Servings' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save servings' }));

    await waitFor(async () => {
      const saved = await db.logEntries.get(entry.id);
      expect(saved?.servings).toBe(1.67);
      expect(saved?.amountMode).toBe('grams');
    });
  });

  it('flips to servings and snaps when the stepper is actually pressed', async () => {
    const user = userEvent.setup();
    const food = await makeRiceFood();
    const entry = createLogEntry(food, {
      date: '2026-10-30',
      meal: 'lunch',
      servings: servingsFromGrams(167, 100),
      amountMode: 'grams',
    });
    await db.logEntries.add(entry);

    renderApp('/?date=2026-10-30');
    await user.click(await screen.findByRole('button', { name: /Cooked white rice.*167 g/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Cooked white rice' });

    await user.click(within(dialog).getByRole('button', { name: 'Servings' }));
    await user.click(within(dialog).getByRole('button', { name: 'Increase servings: Servings' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save servings' }));

    await waitFor(async () => {
      const saved = await db.logEntries.get(entry.id);
      expect(saved?.servings).toBe(2);
      expect(saved?.amountMode).toBe('servings');
    });
    expect(await screen.findByText('2 × 100 g')).toBeTruthy();
  });

  it('edits a legacy entry in servings only, without inventing grams', async () => {
    const user = userEvent.setup();
    const food = await makeRiceFood();
    const entry = createLogEntry(food, { date: '2026-10-30', meal: 'lunch', servings: 1 });
    await db.logEntries.add({
      ...entry,
      amountMode: undefined,
      snapshot: { ...entry.snapshot, servingGrams: undefined },
    });

    renderApp('/?date=2026-10-30');
    await user.click(await screen.findByRole('button', { name: /Cooked white rice.*1 × 100 g/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Cooked white rice' });

    expect(within(dialog).queryByRole('button', { name: 'Grams' })).toBeNull();
    expect(
      within(dialog).getByText(
        'Gram weight was not recorded for this entry, so it is edited in servings only.',
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Increase servings: Servings' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save servings' }));

    await waitFor(async () => {
      const saved = await db.logEntries.get(entry.id);
      expect(saved?.servings).toBe(1.25);
      expect(saved?.amountMode).toBeUndefined();
      expect(saved?.snapshot.servingGrams).toBeUndefined();
    });
  });

  it('lets a 0.1-serving entry step up but never down to zero', async () => {
    const user = userEvent.setup();
    const food = await makeRiceFood();
    const entry = createLogEntry(food, { date: '2026-10-30', meal: 'lunch', servings: 0.1 });
    await db.logEntries.add(entry);

    renderApp('/?date=2026-10-30');
    await user.click(await screen.findByRole('button', { name: /Cooked white rice.*0.1 × 100 g/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Cooked white rice' });

    const decrease = within(dialog).getByRole('button', { name: 'Decrease servings: Servings' });
    expect(decrease).toHaveProperty('disabled', true);

    await user.click(decrease);
    expect(within(dialog).getByText('0.1')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Increase servings: Servings' }));
    expect(within(dialog).getByText('0.25')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Save servings' }));
    await waitFor(async () => expect((await db.logEntries.get(entry.id))?.servings).toBe(0.25));
  });

  it('refuses to write invalid servings straight to the database', async () => {
    const food = await makeRiceFood();
    const entry = createLogEntry(food, { date: '2026-10-30', meal: 'lunch', servings: 1 });
    await db.logEntries.add(entry);

    for (const value of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY, 10_001]) {
      await expect(updateEntryServings(entry.id, value, db)).rejects.toThrow(RangeError);
    }

    expect((await db.logEntries.get(entry.id))?.servings).toBe(1);
  });
});

describe('grams input boundaries', () => {
  it('accepts only finite values above 0 and at most 10000', async () => {
    await makeRiceFood();
    const { dialog, user } = await openRiceSheet();
    const input = within(dialog).getByLabelText('Amount in grams');
    const add = within(dialog).getByRole('button', { name: 'Add to Lunch' });

    // Values are typed as pastes because a type="number" input rejects letters
    // when typed key by key; what the user can actually end up with is below.
    const cases: { text: string; field: string; valid: boolean }[] = [
      { text: '', field: '', valid: false },
      { text: '0', field: '0', valid: false },
      { text: '-5', field: '-5', valid: false },
      { text: 'abc', field: '', valid: false },
      { text: '1e3', field: '1e3', valid: true },
      { text: '10001', field: '10001', valid: false },
      { text: '47.', field: '', valid: false },
      { text: '.5', field: '.5', valid: true },
      { text: '47.5', field: '47.5', valid: true },
      { text: '10000', field: '10000', valid: true },
    ];

    for (const { text, field, valid } of cases) {
      fireEvent.change(input, { target: { value: text } });

      expect((input as HTMLInputElement).value, `field value after "${text}"`).toBe(field);
      expect(add.hasAttribute('disabled'), `button state for "${text}"`).toBe(!valid);
      expect(
        within(dialog).queryByText('Enter grams between 0.1 and 10000.') === null,
        `error state for "${text}"`,
      ).toBe(valid);
    }

    // The largest accepted entry converts cleanly: 10000 g / 100 g = 100 servings.
    fireEvent.change(input, { target: { value: '10000' } });
    expect(within(dialog).getByText('100 servings · 100 g per serving')).toBeTruthy();
    await user.click(add);
    await waitFor(async () => expect(await db.logEntries.count()).toBe(1));
    expect((await db.logEntries.toArray())[0].servings).toBe(100);
  });
});

describe('grams in custom meals', () => {
  it('stores servings, shows grams from the food, and recomputes after the food changes', async () => {
    const user = userEvent.setup();
    const food = await makeRiceFood();
    const foods = await db.foods.toArray();

    render(<MealFormSheet customMeal={null} foods={foods} onClose={() => undefined} />);

    await user.type(screen.getByLabelText('Meal name'), 'Rice bowl');
    await user.type(screen.getByPlaceholderText('Search the library'), 'cooked white rice');
    await user.click(screen.getByRole('button', { name: 'Add Cooked white rice to meal' }));

    await user.click(screen.getByRole('button', { name: 'Grams' }));
    const gramsInput = screen.getByLabelText('Amount in grams');
    await user.clear(gramsInput);
    await user.type(gramsInput, '47');
    expect(screen.getByText('0.47 servings · 47 g')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(async () => expect(await db.customMeals.count()).toBe(1));
    const meal = (await db.customMeals.toArray())[0];
    expect(meal.items).toHaveLength(1);
    expect(meal.items[0].foodId).toBe(food.id);
    expect(meal.items[0].servings).toBeCloseTo(0.47, 12);
    // Only servings are stored: there is no grams field on a custom-meal item.
    expect(Object.keys(meal.items[0]).sort()).toEqual(['foodId', 'servings']);

    // The next time the meal is edited, grams come from the food's current weight.
    cleanup();
    await db.foods.update(food.id, { servingGrams: 150 });
    render(
      <MealFormSheet
        customMeal={meal}
        foods={await db.foods.toArray()}
        onClose={() => undefined}
      />,
    );
    expect(await screen.findByText('0.47 servings · 70.5 g')).toBeTruthy();
  });
});
