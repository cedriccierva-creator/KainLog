import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { seedDatabase } from './db/seed';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root not found in index.html');
}

/**
 * Seed before the first render so screens never flash an empty library.
 * Seeding is insert-only, so this is safe on every launch.
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

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start(container);
