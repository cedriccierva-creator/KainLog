import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The hosted preview needs its Host header allowed, but that must not be baked
 * into the repo. Set KAINLOG_ALLOWED_HOSTS=".example.dev" (comma-separated)
 * before `npm run dev`. Localhost development works without it.
 */
const allowedHosts = process.env.KAINLOG_ALLOWED_HOSTS?.split(',')
  .map((host) => host.trim())
  .filter((host) => host.length > 0);

export default defineConfig({
  plugins: [react()],
  server: {
    // Needed so the sandbox/mobile preview can reach the dev server.
    host: '0.0.0.0',
    port: 5173,
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
