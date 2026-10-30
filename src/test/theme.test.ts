// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { applyTheme, readStoredTheme, resolveTheme, setStoredTheme, systemTheme } from '../lib/theme';

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('applies and persists a choice in meta', async () => {
    await setStoredTheme('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect((await db.meta.get('theme'))?.value).toBe('dark');
    expect(await readStoredTheme()).toBe('dark');
    // Boot mirror for the pre-paint script.
    expect(localStorage.getItem('kainlog:theme')).toBe('dark');

    await setStoredTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(await readStoredTheme()).toBe('light');
  });

  it('follows prefers-color-scheme until the user chooses', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });

    expect(systemTheme()).toBe('dark');
    expect(resolveTheme(null)).toBe('dark');
    // A stored choice always wins over the OS.
    expect(resolveTheme('light')).toBe('light');
  });

  it('applyTheme is idempotent', () => {
    applyTheme('dark');
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
