import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    server: {
      deps: {
        external: ['node:sqlite', 'sqlite'],
      },
    },
  },
  ssr: {
    external: ['node:sqlite', 'sqlite'],
  },
  resolve: {
    alias: {
      'node:sqlite': 'node:sqlite',
      'sqlite': 'node:sqlite',
    },
  },
});
