import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the static build works from any path on any static host.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // One small app, one chunk. React, the drag library and the scenario copy make up most of it.
  build: { chunkSizeWarningLimit: 650 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
