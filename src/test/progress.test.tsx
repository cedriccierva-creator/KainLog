// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, screen } from '@testing-library/react';
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

describe('weekly calories', () => {
  it('shows "no data" for days with nothing logged', async () => {
    renderApp('/progress');

    expect(await screen.findByText('No data yet this week.')).toBeTruthy();
    expect((await screen.findAllByText('no data')).length).toBe(7);
  });

  it('averages only the logged days', async () => {
    const food = await db.foods.get('seed-pork-adobo');
    expect(food).toBeDefined();
    if (!food) return;

    await db.logEntries.add(
      createLogEntry(food, { date: todayKey(), meal: 'lunch', servings: 1 }),
    );

    renderApp('/progress');

    const expected = Math.round(food.kcal);
    expect(await screen.findByText(new RegExp(`Average ${expected} kcal on 1 logged day`))).toBeTruthy();
    expect((await screen.findAllByText('no data')).length).toBe(6);
  });
});

describe('weight log', () => {
  it('upserts one entry per date and draws the 7-day trend', async () => {
    const user = userEvent.setup();
    renderApp('/progress');

    const input = await screen.findByLabelText('Weight (kg)');
    await user.type(input, '70.5');
    await user.click(screen.getByRole('button', { name: 'Log weight' }));
    expect(await screen.findByText(/70\.5 kg/)).toBeTruthy();

    // Same date again replaces instead of adding a second row.
    await user.type(screen.getByLabelText('Weight (kg)'), '71');
    await user.click(screen.getByRole('button', { name: 'Log weight' }));

    const stored = await db.weightEntries.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual({ date: todayKey(), kg: 71 });
    expect(await screen.findByText(/71 kg/)).toBeTruthy();
  });

  it('enforces the 30–300 kg boundaries at the button', async () => {
    const user = userEvent.setup();
    renderApp('/progress');

    const input = await screen.findByLabelText('Weight (kg)');
    const button = screen.getByRole('button', { name: 'Log weight' }) as HTMLButtonElement;

    for (const [value, enabled] of [
      ['29', false],
      ['30', true],
      ['300', true],
      ['301', false],
      ['', false],
    ] as const) {
      await user.clear(input);
      if (value) await user.type(input, value);
      expect(button.disabled).toBe(!enabled);
    }
  });

  it('requires a plausible weight before saving', async () => {
    const user = userEvent.setup();
    renderApp('/progress');

    const input = await screen.findByLabelText('Weight (kg)');
    await user.type(input, '20');

    expect((screen.getByRole('button', { name: 'Log weight' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
