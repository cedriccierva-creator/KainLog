// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { createCustomMeal } from '../db/logActions';
import { renderApp, resetDatabase } from './utils';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

async function makeBrokenMeal() {
  const meal = await createCustomMeal({
    name: 'Adobo rice',
    items: [
      { foodId: 'seed-pork-adobo', servings: 1 },
      { foodId: 'seed-plain-rice', servings: 1 },
    ],
  });
  await db.foods.delete('seed-pork-adobo');
  return meal;
}

describe('missing foods in custom meals', () => {
  it('warns with "N item(s) skipped: food no longer exists" before logging', async () => {
    await makeBrokenMeal();

    const user = userEvent.setup();
    renderApp('/add?meal=lunch');

    await user.click(await screen.findByRole('button', { name: /Adobo rice/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Adobo rice' });

    expect(
      within(dialog).getByText('1 item(s) skipped: food no longer exists'),
    ).toBeTruthy();
  });

  it('flags the missing food in the meal editor', async () => {
    await makeBrokenMeal();

    const user = userEvent.setup();
    renderApp('/foods');

    await user.click(await screen.findByRole('button', { name: 'Edit meal Adobo rice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Adobo rice' });

    expect(within(dialog).getByText('food no longer exists')).toBeTruthy();
  });
});
