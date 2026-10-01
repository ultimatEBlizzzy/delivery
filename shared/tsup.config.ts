import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // No `clean` here: wiping dist while watchers (nest start --watch, vite) are reading it breaks them.
  // The `build` script removes dist explicitly before a full build.
  clean: false,
  sourcemap: false,
  target: 'es2022',
  outDir: 'dist',
});
