import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores (replaces ignorePatterns)
  {
    ignores: [
      'dist/',
      'node_modules/',
      'examples/',
      'temp-original/',
      'coverage/',
      '*.js',
      '*.cjs',
      '*.mjs',
      '*.config.js',
      '*.config.cjs',
      '*.config.ts',
    ],
  },

  // Base recommended rules
  ...tseslint.configs.recommended,

  // Type-checked rules (replaces recommended-requiring-type-checking)
  ...tseslint.configs.recommendedTypeChecked,

  // Prettier must be last to disable conflicting rules
  eslintConfigPrettier,

  // Project-wide settings and custom rules
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Relax strict type-safety rules in test files: catch blocks (.catch((e) => e))
  // and asymmetric matchers (expect.objectContaining) inherently produce `any` types.
  {
    files: ['src/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  }
);
