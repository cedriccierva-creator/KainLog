// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

function Screens() {
  return (
    <Routes>
      <Route path="/" element={<p>Diary screen</p>} />
      <Route path="/foods" element={<p>Foods screen</p>} />
      <Route path="/progress" element={<p>Progress screen</p>} />
      <Route path="/profile" element={<p>Profile screen</p>} />
      <Route path="/add" element={<p>Add screen</p>} />
    </Routes>
  );
}

function renderAt(entries: string[], index = 0, extra?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <NativeBackHandler />
      {extra}
      <Screens />
    </MemoryRouter>,
  );
}

async function pressBack(): Promise<void> {
  await waitFor(() => expect(mocks.listeners.length).toBe(1));
  await act(async () => {
    mocks.listeners[0]();
  });
}

function HashProbe() {
  const location = useLocation();
  return <p data-testid="hash-location">{`${location.pathname}|${location.key}`}</p>;
}

function HashNav() {
  return (
    <nav>
      <Link to="/foods">to foods</Link>
      <Link to="/add">to add</Link>
    </nav>
  );
}

beforeEach(() => {
  mocks.listeners.length = 0;
  mocks.exitApp.mockClear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('decideNativeBack', () => {
  it('closes a sheet before touching navigation', () => {
    expect(decideNativeBack(true, '/')).toBe('close-sheet');
    expect(decideNativeBack(true, '/foods')).toBe('close-sheet');
    expect(decideNativeBack(true, '/add')).toBe('close-sheet');
  });

  it('sends every tab to the Diary', () => {
    expect(decideNativeBack(false, '/foods')).toBe('go-diary');
    expect(decideNativeBack(false, '/progress')).toBe('go-diary');
    expect(decideNativeBack(false, '/profile')).toBe('go-diary');
    expect(decideNativeBack(false, '/something-else')).toBe('go-diary');
  });

  it('pops pushed screens and exits at the Diary', () => {
    expect(decideNativeBack(false, '/add')).toBe('go-back');
    expect(decideNativeBack(false, '/')).toBe('exit');
  });
});

describe('NativeBackHandler', () => {
  it('exits the app when Back is pressed at the diary with no sheet open', async () => {
    renderAt(['/']);
    await pressBack();

    expect(mocks.exitApp).toHaveBeenCalledTimes(1);
  });

  it.each(['/foods', '/progress', '/profile'])('Back from %s goes to the Diary', async (path) => {
    renderAt([path]);
    await pressBack();

    expect(await screen.findByText('Diary screen')).toBeTruthy();
    expect(mocks.exitApp).not.toHaveBeenCalled();
  });

  it('Back from Add Food pops back to the previous screen', async () => {
    renderAt(['/foods', '/add'], 1);
    await pressBack();

    // navigate(-1) returns to the entry that pushed Add Food.
    expect(await screen.findByText('Foods screen')).toBeTruthy();
    expect(mocks.exitApp).not.toHaveBeenCalled();
  });

  it('falls back to the Diary when Add Food is the first location (key "default")', async () => {
    // The first memory entry carries location.key === 'default', i.e. there is
    // no in-app history to pop.
    renderAt(['/add']);
    await pressBack();

    expect(await screen.findByText('Diary screen')).toBeTruthy();
    expect(mocks.exitApp).not.toHaveBeenCalled();
  });

  it('pops the sheet history entry instead of exiting when a sheet is open', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/']}>
        <NativeBackHandler />
        <Sheet open title="Test sheet" onClose={() => undefined}>
          <p>sheet body</p>
        </Sheet>
        <Screens />
      </MemoryRouter>,
    );

    await screen.findByText('Test sheet');
    await pressBack();

    expect(back).toHaveBeenCalledTimes(1);
    expect(mocks.exitApp).not.toHaveBeenCalled();
    back.mockRestore();
  });
});

describe('HashRouter (real browser history)', () => {
  function renderHash() {
    return render(
      <HashRouter>
        <NativeBackHandler />
        <HashProbe />
        <HashNav />
        <Screens />
      </HashRouter>,
    );
  }

  it('sees key "default" when the app mounts on a hash URL, and Back falls back to the Diary', async () => {
    window.location.hash = '#/add';
    renderHash();

    const probe = await screen.findByTestId('hash-location');
    console.log('[hashrouter] initial location:', probe.textContent);
    expect(probe.textContent).toBe('/add|default');

    await pressBack();
    expect(await screen.findByText('Diary screen')).toBeTruthy();
    expect(mocks.exitApp).not.toHaveBeenCalled();
  });

  it('uses a real pop when the history was pushed (key is not "default")', async () => {
    const user = userEvent.setup();
    renderHash();

    const initial = await screen.findByTestId('hash-location');
    console.log('[hashrouter] initial location:', initial.textContent);

    await user.click(screen.getByRole('link', { name: 'to foods' }));
    const foods = await screen.findByTestId('hash-location');
    console.log('[hashrouter] pushed /foods key:', foods.textContent);

    await user.click(screen.getByRole('link', { name: 'to add' }));
    await waitFor(() =>
      expect(screen.getByTestId('hash-location').textContent?.startsWith('/add|')).toBe(true),
    );
    const add = screen.getByTestId('hash-location');
    console.log('[hashrouter] pushed /add key:', add.textContent);

    const key = add.textContent?.split('|')[1];
    expect(key).toBeTruthy();
    expect(key).not.toBe('default');

    await pressBack();
    // navigate(-1) pops to the screen that pushed Add Food, not the Diary.
    expect(await screen.findByText('Foods screen')).toBeTruthy();
  });
});
