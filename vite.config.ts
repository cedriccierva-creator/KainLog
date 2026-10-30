import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The hosted preview needs its Host header allowed, but that must not be baked
 * into the repo. Set KAINLOG_ALLOWED_HOSTS=".example.dev" (comma-separated)
 * before `npm run dev`. Localhost development works without it.
 */
const allowedHosts = process.env.KAINLOG_ALLOWED_HOSTS?.split(',')
  .map((host) => host.trim())
  .filter((host) => host.length > 0);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The service worker is registered by src/components/UpdatePrompt.tsx,
      // and not at all in the Capacitor build.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'KainLog — Filipino calorie tracker',
        short_name: 'KainLog',
        description:
          'Offline-first calorie and macro tracker with a built-in Filipino food library.',
        lang: 'en-PH',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#047857',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // Needed so the sandbox/mobile preview can reach the dev server.
    host: '0.0.0.0',
    port: 5173,
    // Don't watch build output: dist is copied into android/ by cap sync, and
    // the copied HTML would otherwise trigger needless full reloads.
    watch: { ignored: ['**/android/**', '**/dist/**'] },
    ...(allowedHosts && allowedHosts.length > 0 ? { allowedHosts } : {}),
  },
  test: {
    // Dexie tests run in Node against fake-indexeddb. UI tests opt into jsdom
    // per file with `// @vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.{ts,tsx}'],
  },
});
