// Shared flat ESLint configuration for all MusicVerse workspaces.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Base config for TypeScript code (Node + browser globals). */
export const base = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/next-env.d.ts',
      '**/*.config.{js,cjs,mjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}', '**/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
);

/** Config for React code (adds hooks rules). */
export const react = tseslint.config(...base, {
  files: ['**/*.{tsx,ts}'],
  plugins: { 'react-hooks': reactHooks },
  rules: {
    ...reactHooks.configs.recommended.rules,
  },
});

/**
 * NestJS relies on runtime decorator metadata, so imports used only as constructor
 * parameter types must remain value imports.
 */
export const nest = tseslint.config(...base, {
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
  },
});

export default base;
