import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      '.claude/',
      'dist/',
      '.astro/',
      'node_modules/',
      'pipeline/',
      'public/',
      'test-results/',
      'playwright-report/',
      '.lighthouseci/',
      '.wrangler/',
      'docs/checks/tools/',
      'docs/checks/**/test-results/',
    ],
  },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'writable', process: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
