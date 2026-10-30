import { db } from '../db/db';

export type Theme = 'light' | 'dark';

/** meta row that remembers the user's choice. Absent = follow the OS. */
export const META_THEME = 'theme';

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export async function readStoredTheme(): Promise<Theme | null> {
  const record = await db.meta.get(META_THEME);
  return record?.value === 'dark' || record?.value === 'light' ? record.value : null;
}

export async function setStoredTheme(theme: Theme): Promise<void> {
  await db.meta.put({ key: META_THEME, value: theme });
  // Mirror for the pre-paint script in index.html; IndexedDB is not readable
  // synchronously during boot.
  try {
    localStorage.setItem('kainlog:theme', theme);
  } catch {
    // Storage can be blocked; the in-app class still applies.
  }
  applyTheme(theme);
}

/** The effective theme when the user has not chosen one. */
export function resolveTheme(stored: Theme | null | undefined): Theme {
  return stored ?? systemTheme();
}
