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

/**
 * Apply a theme to the document and refresh the boot mirror.
 * The mirror exists only because index.html cannot read IndexedDB synchronously
 * before first paint; meta stays the source of truth.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('kainlog:theme', theme);
    }
  } catch {
    // Storage can be blocked (private mode); the class above still applies.
  }
}

export async function readStoredTheme(): Promise<Theme | null> {
  const record = await db.meta.get(META_THEME);
  return record?.value === 'dark' || record?.value === 'light' ? record.value : null;
}

export async function setStoredTheme(theme: Theme): Promise<void> {
  await db.meta.put({ key: META_THEME, value: theme });
  applyTheme(theme);
}

/** The effective theme when the user has not chosen one. */
export function resolveTheme(stored: Theme | null | undefined): Theme {
  return stored ?? systemTheme();
}

/**
 * Boot/import entry point: meta wins over a stale mirror or the OS setting.
 * Returns the theme that was applied.
 */
export async function applyStoredTheme(): Promise<Theme> {
  const theme = resolveTheme(await readStoredTheme());
  applyTheme(theme);
  return theme;
}
