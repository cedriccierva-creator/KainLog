// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<() => void>,
  exitApp: vi.fn(),
  remove: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: string, callback: () => void) => {
      mocks.listeners.push(callback);
      return { remove: mocks.remove };
    }),
    exitApp: mocks.exitApp,
  },
}));

vi.mock('../lib/platform', () => ({
  isNativePlatform: () => true,
  shouldRegisterServiceWorker: () => false,
}));

import NativeBackHandler from '../components/NativeBackHandler';
import { Sheet } from '../components/ui';
import { decideNativeBack } from '../lib/nativeBack';

beforeEach(() => {
  mocks.listeners.length = 0;
  mocks.exitApp.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('decideNativeBack', () => {
  it('closes a sheet before touching navigation', () => {
    expect(decideNativeBack(true, true)).toBe('close-sheet');
    expect(decideNativeBack(true, false)).toBe('close-sheet');
  });

  it('walks back through routes, then exits at home', () => {
    expect(decideNativeBack(false, false)).toBe('go-back');
    expect(decideNativeBack(false, true)).toBe('exit');
  });
});

describe('NativeBackHandler', () => {
  it('exits the app when Back is pressed at the diary with no sheet open', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NativeBackHandler />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.listeners.length).toBe(1));
    mocks.listeners[0]();

    expect(mocks.exitApp).toHaveBeenCalledTimes(1);
  });

  it('pops the sheet history entry instead of exiting when a sheet is open', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/']}>
        <NativeBackHandler />
        <Sheet open title="Test sheet" onClose={() => undefined}>
          <p>sheet body</p>
        </Sheet>
      </MemoryRouter>,
    );

    await screen.findByText('Test sheet');
    await waitFor(() => expect(mocks.listeners.length).toBe(1));
    mocks.listeners[0]();

    expect(back).toHaveBeenCalledTimes(1);
    expect(mocks.exitApp).not.toHaveBeenCalled();
    back.mockRestore();
  });
});
