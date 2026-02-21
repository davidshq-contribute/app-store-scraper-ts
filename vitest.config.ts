import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false, // use explicit imports from 'vitest' in test files
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.*',
        '**/types/**',
        'examples/**',
      ],
    },
  },
});
