import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { seedDatabase } from './db/seed';
import { applyTheme, readStoredTheme, resolveTheme } from './lib/theme';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root not found in index.html');
}

/**
 * Seed before the first render so screens never flash an empty library.
 * Seeding only inserts missing foods and refreshes untouched seed rows, so it
 * is safe on every launch.
 */
async function start(root: HTMLElement): Promise<void> {
  try {
    await seedDatabase();
  } catch (error) {
    root.innerHTML =
      '<p style="padding:1rem;font-family:system-ui">KainLog could not open local storage. Private/incognito mode blocks IndexedDB on some browsers.</p>';
    console.error('Failed to open KainLog database', error);
    return;
  }

  // index.html sets the class before paint; re-apply here in case the stored
  // preference or the OS setting changed since that inline script ran.
  applyTheme(resolveTheme(await readStoredTheme()));

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start(container);
