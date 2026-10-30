// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { renderApp, resetDatabase } from './utils';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

describe('food badges', () => {
  it('flips a seed food from "estimate" to "custom" after the user edits it', async () => {
    const user = userEvent.setup();
    renderApp('/foods');

    await screen.findByRole('heading', { name: 'Foods' });
    await user.click(await screen.findByRole('button', { name: /Pork Adobo/ }));

    const detail = await screen.findByRole('dialog', { name: 'Pork Adobo' });
    expect(within(detail).getAllByText('estimate').length).toBeGreaterThan(0);

    await user.click(within(detail).getByRole('button', { name: 'Edit food' }));

    const form = await screen.findByRole('dialog', { name: 'Edit Pork Adobo' });
    const kcalInput = within(form).getByLabelText('Calories (kcal)');
    await user.clear(kcalInput);
    await user.type(kcalInput, '250');
    await user.click(within(form).getByRole('button', { name: 'Save food' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const stored = await db.foods.get('seed-pork-adobo');
    expect(stored?.source).toBe('user');
    expect(stored?.verified).toBe(false);
    expect(stored?.kcal).toBe(250);

    await user.click(await screen.findByRole('button', { name: /Pork Adobo/ }));
    const reopened = await screen.findByRole('dialog', { name: 'Pork Adobo' });
    expect(within(reopened).getAllByText('custom').length).toBeGreaterThan(0);
    expect(within(reopened).queryByText('estimate')).toBeNull();
  });
});

describe('custom meals', () => {
  it('creates a meal from the Foods screen', async () => {
    const user = userEvent.setup();
    renderApp('/foods');
    await screen.findByRole('heading', { name: 'Foods' });

    await user.click(screen.getByRole('button', { name: 'New meal' }));
    const dialog = await screen.findByRole('dialog', { name: 'New meal' });

    await user.type(within(dialog).getByLabelText('Meal name'), 'Adobo rice');
    // The picker starts with the first few foods, so search for the one we want.
    await user.type(within(dialog).getByLabelText('Add a food'), 'Pork Adobo');
    await user.click(
      await within(dialog).findByRole('button', { name: 'Add Pork Adobo to meal' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const meals = await db.customMeals.toArray();
    expect(meals).toHaveLength(1);
    expect(meals[0]?.name).toBe('Adobo rice');
    expect(meals[0]?.items[0]?.foodId).toBe('seed-pork-adobo');

    expect(await screen.findByText('Adobo rice')).toBeTruthy();
  });
});
