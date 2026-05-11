import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: false, // use explicit imports from 'vitest' in test files
    environment: 'node',
    pool: 'forks', // avoids "Failed to Terminate Worker" / watch-mode hangs when using Node fetch
    // Stryker copies the project under .stryker-tmp; without this, vitest runs every test twice.
    exclude: [...configDefaults.exclude, '**/.stryker-tmp/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.*',
        '**/types/**',
        'examples/**',
        '**/.stryker-tmp/**',
      ],
    },
  },
});
