import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shell. `npm run cap:sync` builds the web app and copies `dist/`
 * into the Android project. Signing credentials are never stored here; release
 * keystores live outside the repo (see BUILD_ANDROID.md).
 */
const config: CapacitorConfig = {
  appId: 'ph.kainlog.app',
  appName: 'KainLog',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
