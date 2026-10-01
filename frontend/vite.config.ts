import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Public VITE_* variables come from the repo-root .env (the same file the API reads).
  const envDir = resolve(__dirname, '..');
  const env = loadEnv(mode, envDir, '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3000';

  // The browser only ever talks to its own origin; the dev server forwards API and upload
  // requests to the backend. This is also how nginx is configured in the Docker image.
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  };

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: true, // reachable through preview/tunnel hostnames
      proxy,
    },
    preview: { host: '0.0.0.0', port: 4173, allowedHosts: true, proxy },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query', 'zustand', 'zod', 'react-hook-form'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
