// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTodayKey } from '../hooks/useTodayKey';
import { renderApp, resetDatabase } from './utils';

function TodayProbe() {
  return <span data-testid="today">{useTodayKey()}</span>;
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useTodayKey', () => {
  it('rolls over at local midnight while the app stays open', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 30));

    render(<TodayProbe />);
    expect(screen.getByTestId('today').textContent).toBe('2026-10-31');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });

    expect(screen.getByTestId('today').textContent).toBe('2026-11-01');
  });

  it('re-reads the clock when the app returns to the foreground', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));

    render(<TodayProbe />);
    expect(screen.getByTestId('today').textContent).toBe('2026-10-31');

    vi.setSystemTime(new Date(2026, 10, 1, 9, 0, 0));
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByTestId('today').textContent).toBe('2026-11-01');
  });
});

describe('Diary date across midnight', () => {
  it('moves the Diary to the new day without a reload', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 30));

    renderApp('/');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(screen.getByText('2026-10-31')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });

    expect(screen.getByText('2026-11-01')).toBeTruthy();
  });
});
