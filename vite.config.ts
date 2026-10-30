import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Needed so the sandbox/mobile preview can reach the dev server.
    host: '0.0.0.0',
    port: 5173,
    // Vite 7 rejects unknown Host headers; allow the hosted preview domain.
    // `npm run dev` on your own machine still uses localhost, which is allowed by default.
    allowedHosts: ['.e2b.app'],
  },
  test: {
    // Dexie tests run in Node against fake-indexeddb; no DOM is required yet.
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
  },
});
