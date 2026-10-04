/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The browser talks only to :5173; Vite forwards /api to Express on :3000.
    // One origin = no CORS, and cookies just work. See docs/01-how-the-web-works.md.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less often than our code, so they get their own files. After a
        // deploy, browsers re-download only the small app file and keep the cached libraries.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
