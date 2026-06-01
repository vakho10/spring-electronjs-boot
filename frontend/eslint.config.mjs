import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['out', 'dist', 'release', 'node_modules', '**/*.d.ts'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Plain-JS build scripts (e.g. scripts/make-runtime.mjs) run under Node.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' }
    }
  },
  {
    rules: {
      // Allow intentionally-unused args/vars when prefixed with an underscore
      // (e.g. the ignored `_e` event arg in ipcMain handlers).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
)
