import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react*', 'vue*', 'svelte*', 'solid*', 'angular*'],
              message: '@weave-kit/client must be framework-agnostic — no UI framework imports',
            },
          ],
        },
      ],
    },
  },
);
