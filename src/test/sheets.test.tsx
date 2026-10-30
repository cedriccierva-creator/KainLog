// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { todayKey } from '../lib/date';
import { createLogEntry } from '../lib/nutrition';
import { renderApp, resetDatabase } from './utils';

beforeEach(async () => {
  await resetDatabase();
  const food = await db.foods.get('seed-pork-adobo');
  if (food) {
    await db.logEntries.add(
      createLogEntry(food, { date: todayKey(), meal: 'lunch', servings: 1 }),
    );
  }
});

afterEach(() => {
  cleanup();
});

async function openRelogSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Log again: Pork Adobo' }));
  return screen.findByRole('dialog', { name: 'Pork Adobo' });
}

describe('sheet behaviour', () => {
  it('moves focus into the sheet, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const chip = await screen.findByRole('button', { name: 'Log again: Pork Adobo' });
    await user.click(chip);

    const dialog = await screen.findByRole('dialog', { name: 'Pork Adobo' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(chip);
  });

  it('closes on browser/Android Back (popstate) without leaving the screen', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await openRelogSheet(user);

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Still on the Diary, not navigated away.
    expect(screen.getByText('KainLog')).toBeTruthy();
  });

  it('keeps Tab focus inside the sheet', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const dialog = await openRelogSheet(user);

    for (let step = 0; step < 10; step += 1) {
      await user.tab();
    }

    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
