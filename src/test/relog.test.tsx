// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { todayKey } from '../lib/date';
import { createLogEntry } from '../lib/nutrition';
import { renderApp, resetDatabase } from './utils';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

describe('quick re-log from the Diary (acceptance: ≤3 taps)', () => {
  it('re-logs a recent food in 2 taps', async () => {
    const food = await db.foods.get('seed-pork-adobo');
    expect(food).toBeDefined();
    if (!food) return;

    await db.logEntries.add(
      createLogEntry(food, { date: todayKey(), meal: 'lunch', servings: 1 }),
    );

    const user = userEvent.setup();
    renderApp('/');

    let taps = 0;

    // Tap 1: the recent chip on the Diary.
    await user.click(await screen.findByRole('button', { name: 'Log again: Pork Adobo' }));
    taps += 1;

    // Tap 2: confirm in the sheet.
    await user.click(await screen.findByRole('button', { name: 'Add to Lunch' }));
    taps += 1;

    await waitFor(async () => {
      expect(await db.logEntries.count()).toBe(2);
    });

    expect(taps).toBeLessThanOrEqual(3);

    const entries = await db.logEntries.toArray();
    const newest = entries.sort((a, b) => b.createdAt - a.createdAt)[0];
    expect(newest?.meal).toBe('lunch');
    expect(newest?.date).toBe(todayKey());
    expect(newest?.snapshot.foodName).toBe('Pork Adobo');
  });
});
