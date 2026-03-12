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
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  }
);
