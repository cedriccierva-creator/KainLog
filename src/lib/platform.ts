import { Capacitor } from '@capacitor/core';

/** True inside the Android WebView build, false in a browser. */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * The browser needs the service worker for offline use; the APK already ships
 * its own assets, so registering a SW there would only add a stale second copy.
 */
export function shouldRegisterServiceWorker(prod: boolean, native: boolean): boolean {
  return prod && !native;
}
