import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { hasOpenSheet } from '../lib/sheetState';
import { decideNativeBack } from '../lib/nativeBack';
import { isNativePlatform } from '../lib/platform';

/**
 * Android hardware/gesture Back inside the Capacitor WebView.
 *
 * Capacitor core (the @capacitor/android package) installs no Back callback;
 * @capacitor/app is what registers the OnBackPressedCallback and forwards the
 * event to JS, and only when a listener exists. KainLog registers one so Back
 * follows the app's routing policy (sheet -> tabs -> Diary -> exit).
 * Unverified on a physical device: test with both gesture and 3-button
 * navigation.
 */
export default function NativeBackHandler() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const locationKeyRef = useRef(location.key);
  locationKeyRef.current = location.key;

  useEffect(() => {
    if (!isNativePlatform()) return;

    let removed = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void App.addListener('backButton', () => {
      const action = decideNativeBack(hasOpenSheet(), pathRef.current);
      if (action === 'close-sheet') {
        // The open sheet pushed a history entry; popping it fires popstate,
        // which is what actually closes the sheet and restores focus.
        window.history.back();
        return;
      }
      if (action === 'go-back') {
        // 'default' means this is the first location of the session, so there
        // is no in-app entry to pop; go to the Diary instead of doing nothing.
        if (locationKeyRef.current === 'default') {
          navigateRef.current('/');
        } else {
          navigateRef.current(-1);
        }
        return;
      }
      if (action === 'go-diary') {
        navigateRef.current('/');
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
  }, []);

  return null;
}
