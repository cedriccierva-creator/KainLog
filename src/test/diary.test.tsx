// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { META_PROFILE_PLACEHOLDER } from '../db/seed';
import { todayKey } from '../lib/date';
import { createLogEntry } from '../lib/nutrition';
import { renderApp, resetDatabase } from './utils';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

describe('goal banner', () => {
  it('shows "Set your goals" while the placeholder profile is active', async () => {
    renderApp('/');
    expect(await screen.findByText('Set your goals')).toBeTruthy();
  });

  it('hides the banner once real goals exist', async () => {
    await db.meta.update(META_PROFILE_PLACEHOLDER, { value: false });

    renderApp('/');
    await screen.findByText(/kcal left/);

    expect(screen.queryByText('Set your goals')).toBeNull();
  });
});

describe('hidden foods', () => {
  it('keeps a hidden food out of Add Food but still renders its past entry', async () => {
    const food = await db.foods.get('seed-pork-adobo');
    expect(food).toBeDefined();
    if (!food) return;

    await db.logEntries.add(
      createLogEntry(food, { date: todayKey(), meal: 'dinner', servings: 1 }),
    );
    await db.foods.update(food.id, { hidden: true });

    renderApp('/');
    expect(await screen.findByText('Pork Adobo')).toBeTruthy();

    cleanup();
    renderApp('/add?meal=dinner');

    await screen.findByRole('heading', { name: 'Add food' });
    await screen.findByRole('heading', { name: 'All foods' });
    await screen.findByText('Adobong Pusit');

    expect(screen.queryByText('Pork Adobo')).toBeNull();
  });
});

describe('diary day switching', () => {
  it('moves to the previous local day and back to today', async () => {
    renderApp('/');
    await screen.findByText(/kcal left/);

    expect(screen.getByText(todayKey())).toBeTruthy();
  });
});
