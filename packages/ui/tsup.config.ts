import { defineConfig } from 'tsup';

const shared = {
  format: ['esm', 'cjs'] as const,
  dts: true,
  sourcemap: true,
  target: 'es2022',
  external: ['react', 'react-dom'],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
    // Components use hooks/events; mark the bundle as client code for React Server Components.
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    // Pure class helpers, safe to call from Server Components.
    entry: { classes: 'src/classes.ts' },
    clean: false,
  },
]);
