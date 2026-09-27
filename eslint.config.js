import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.turbo/**',
      'catalyst-ui-kit/**',
      'apps/web/src/components/catalyst/**',
      'apps/api/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: [
      'scripts/**/*.{js,mjs}',
      'apps/api/scripts/**/*.{js,mjs,cjs}',
      'api/**/*.js',
      '**/*.config.{js,ts}',
      'apps/api/**/*.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // NestJS injects constructor parameters by their runtime class (decorator metadata), so those
    // imports must stay value imports. This tells the type-import rule about it.
    files: ['apps/api/**/*.ts'],
    languageOptions: { parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
