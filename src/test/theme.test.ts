// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { applyBackup, buildBackup } from '../db/backup';
import { seedDatabase } from '../db/seed';
import {
  applyStoredTheme,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  setStoredTheme,
  systemTheme,
} from '../lib/theme';

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

  it('importing a dark backup updates meta, the mirror and the class together', async () => {
    await seedDatabase(db);
    await setStoredTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    const backup = await buildBackup();
    const darkBackup = {
      ...backup,
      tables: {
        ...backup.tables,
        meta: backup.tables.meta.map((record) =>
          record.key === 'theme' ? { ...record, value: 'dark' } : record,
        ),
      },
    };

    await applyBackup(darkBackup);

    expect((await db.meta.get('theme'))?.value).toBe('dark');
    expect(localStorage.getItem('kainlog:theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('on boot, a stale mirror resolves to the meta value', async () => {
    await seedDatabase(db);
    await setStoredTheme('light');
    // Simulate meta being dark while the pre-paint mirror is still light.
    await db.meta.put({ key: 'theme', value: 'dark' });
    localStorage.setItem('kainlog:theme', 'light');
    document.documentElement.classList.remove('dark');

    const applied = await applyStoredTheme();

    expect(applied).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('kainlog:theme')).toBe('dark');
  });

  it('applyTheme is idempotent', () => {
    applyTheme('dark');
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
