import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Canvas-only verification deliberately excludes unrelated prototype suites. */
export default defineConfig({
  resolve: {
    alias: {
      '@novakai/canvas': fileURLToPath(new URL('./contract/index.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      'packages/canvas/tests/**/*.test.ts',
      'src/presentation/**/*.test.ts',
      'src/presentation/**/*.test.tsx',
      'src/second-host.test.ts',
    ],
    exclude: ['src/presentation/prototype/**'],
  },
});
