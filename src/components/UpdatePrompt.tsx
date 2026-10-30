import { useEffect, useRef, useState } from 'react';
import { isNativePlatform, shouldRegisterServiceWorker } from '../lib/platform';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Service-worker update prompt.
 *
 * Registration is skipped entirely inside the Capacitor build: the APK ships
 * its own assets, and a cached SW inside the WebView would only add a second,
 * stale copy of the app. In the browser the SW is registered manually (the
 * plugin does not inject a registration script) so this component is the single
 * place that decides whether a service worker exists.
 */
export default function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [reloading, setReloading] = useState(false);
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // `import.meta.env.PROD` keeps tests and `npm run dev` free of service
    // workers; the dynamic import means the virtual module is never evaluated
    // in the native build.
    if (!shouldRegisterServiceWorker(import.meta.env.PROD, isNativePlatform())) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      updateRef.current = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          setOfflineReady(true);
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          // A long-lived tab would otherwise keep showing the old version.
          timer = setInterval(() => {
            void registration.update();
          }, CHECK_INTERVAL_MS);
        },
      });
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) return;
    const timeout = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(timeout);
  }, [offlineReady]);

  async function reload(): Promise<void> {
    setReloading(true);
    try {
      await updateRef.current?.(true);
    } finally {
      setReloading(false);
    }
  }

  if (needRefresh) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lg dark:border-emerald-900 dark:bg-slate-900"
      >
        <p className="text-sm font-semibold">A new KainLog version is ready.</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Reload to finish updating. Your data stays on this device.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="min-h-11 flex-1 rounded-xl border border-slate-300 text-sm font-medium dark:border-slate-700"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={reloading}
            className="min-h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950"
          >
            {reloading ? 'Reloading…' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <p
        role="status"
        className="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 mx-auto w-fit rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Ready to work offline
      </p>
    );
  }

  return null;
}
