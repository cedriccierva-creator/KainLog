// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { META_PROFILE_PLACEHOLDER } from '../db/seed';
import { renderApp, resetDatabase } from './utils';

beforeEach(async () => {
  await resetDatabase();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('profile goals', () => {
  it('shows a hand-checkable suggestion for the placeholder stats', async () => {
    renderApp('/profile');

    // male 25y / 170cm / 65kg, moderate (1.55), maintain:
    // BMR = 650 + 1062.5 − 125 + 5 = 1592.5; TDEE = 2468.375 → 2470 kcal.
    expect((await screen.findByTestId('suggested-kcal')).textContent).toBe('2470 kcal');
    expect(screen.getAllByText(/placeholder goals/i).length).toBeGreaterThan(0);
  });

  it('saves goals and clears the placeholder banner', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Save goals' }));
    expect(await screen.findByText('Goals saved.')).toBeTruthy();

    expect((await db.meta.get(META_PROFILE_PLACEHOLDER))?.value).toBe(false);
    expect(screen.queryByText(/placeholder goals/i)).toBeNull();
  });

  it('warns when macros drift more than 2% from the target', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    const protein = await screen.findByLabelText('Protein');
    await user.clear(protein);
    await user.type(protein, '300');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/off your 2000 kcal target/)).toBeTruthy();
  });

  it('rejects out-of-range stats and disables saving', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    const age = await screen.findByLabelText('Age');
    await user.clear(age);
    await user.type(age, '12');

    expect(await screen.findByText(/Age must be between 18 and 100/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save goals' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('safety floor', () => {
  it('warns below the male floor of 1500 kcal and still lets you save', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    const target = await screen.findByLabelText('Daily calorie target');
    await user.clear(target);
    await user.type(target, '1200');

    expect((await screen.findByTestId('floor-warning')).textContent).toContain('1500 kcal');

    const save = screen.getByRole('button', { name: 'Save goals' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await user.click(save);

    expect(await screen.findByText('Goals saved.')).toBeTruthy();
    expect((await db.profile.get('me'))?.kcalTarget).toBe(1200);
  });

  it('switches to the female floor and hides the warning at 1200', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    await user.click(await screen.findByRole('button', { name: 'Female' }));
    const target = screen.getByLabelText('Daily calorie target');
    await user.clear(target);
    await user.type(target, '1100');

    expect((await screen.findByTestId('floor-warning')).textContent).toContain('1200 kcal');

    await user.clear(target);
    await user.type(target, '1200');
    expect(screen.queryByTestId('floor-warning')).toBeNull();
  });
});

describe('dark mode', () => {
  it('persists the choice in meta and toggles the html class', async () => {
    const user = userEvent.setup();
    renderApp('/profile');

    const toggle = await screen.findByRole('switch', { name: 'Dark mode' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await user.click(toggle);

    expect(await screen.findByRole('switch', { name: 'Dark mode', checked: true })).toBeTruthy();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect((await db.meta.get('theme'))?.value).toBe('dark');

    await user.click(toggle);
    expect(await screen.findByRole('switch', { name: 'Dark mode', checked: false })).toBeTruthy();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect((await db.meta.get('theme'))?.value).toBe('light');
  });
});
