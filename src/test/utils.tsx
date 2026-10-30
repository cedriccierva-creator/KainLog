import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../AppRoutes';
import { db } from '../db/db';
import { seedDatabase } from '../db/seed';

/** Fresh, seeded database for each UI test (the app's own singleton). */
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
  await seedDatabase(db);
}

/** Render the real routes inside a MemoryRouter so tests can deep-link. */
export function renderApp(path = '/'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}
