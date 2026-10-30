// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppRoutes from '../AppRoutes';
import { buildBackup } from '../db/backup';
import { exportBackupFile } from '../lib/backupFile';
import { resetDatabase } from './utils';

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(async () => ({ uri: 'file:///cache/file.json' })),
  getUri: vi.fn(async () => ({ uri: 'file:///cache/kainlog-backup.json' })),
  share: vi.fn(async () => ({ activityType: 'save' })),
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mocks.writeFile, getUri: mocks.getUri },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: mocks.share },
}));

vi.mock('../lib/platform', () => ({
  isNativePlatform: () => true,
  shouldRegisterServiceWorker: () => false,
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async () => ({ remove: async () => undefined })),
    exitApp: vi.fn(),
  },
}));

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

describe('export on native', () => {
  it('uses the share path by default when Capacitor reports native', async () => {
    const backup = await buildBackup();
    const result = await exportBackupFile(backup); // no explicit platform flag

    expect(result.method).toBe('share');
    expect(mocks.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.share).toHaveBeenCalledTimes(1);
  });
});

describe('Profile on native', () => {
  it('explains Android storage instead of offering a browser persistence request', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect((await screen.findByTestId('persistence-state')).textContent).toMatch(
      /app-private storage/,
    );
    expect(screen.queryByRole('button', { name: 'Request persistent storage' })).toBeNull();
    expect(screen.getByText(/uninstalling the app deletes the log/)).toBeTruthy();
  });
});
