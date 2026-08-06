import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    alias: {
      '@karrkarr/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  resolve: {
    alias: {
      '@karrkarr/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
