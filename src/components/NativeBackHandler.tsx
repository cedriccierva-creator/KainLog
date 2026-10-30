import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { hasOpenSheet } from '../lib/sheetState';
import { decideNativeBack } from '../lib/nativeBack';
import { isNativePlatform } from '../lib/platform';

/**
 * Android hardware/gesture Back inside the Capacitor WebView.
 *
 * Capacitor core 8 has no Back handling; @capacitor/app installs an
 * OnBackPressedCallback that only reports an event. Without a listener the
 * plugin falls back to WebView history, which exits the app when a sheet is
 * open on a fresh page load. Registering here makes Back always close a sheet
 * first, then walk back through routes, then exit.
 */
export default function NativeBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!isNativePlatform()) return;

    let removed = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void App.addListener('backButton', () => {
      const action = decideNativeBack(hasOpenSheet(), pathRef.current === '/');
      if (action === 'close-sheet') {
        // The open sheet pushed a history entry; popping it fires popstate,
        // which is what actually closes the sheet and restores focus.
        window.history.back();
        return;
      }
      if (action === 'go-back') {
        navigate(-1);
        return;
      }
      void App.exitApp();
    }).then((listener) => {
      if (removed) {
        void listener.remove();
      } else {
        handle = listener;
      }
    });

    return () => {
      removed = true;
      if (handle) void handle.remove();
    };
  }, [navigate]);

  return null;
}
