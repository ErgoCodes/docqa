import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import nPlugin from 'eslint-plugin-n';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Archivos de configuración (vitest.config.ts, vite.config.ts, ...) no
    // están incluidos en el tsconfig.json de su paquete (include: ["src"]),
    // así que no tienen "programa" de TypeScript que analizar con reglas
    // type-aware — se lintean solo a nivel sintáctico.
    files: ['**/*.config.{ts,mts,cts}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      // Los mocks de vitest (`expect(obj.metodo).toHaveBeenCalled()`) pasan
      // referencias de método sin invocarlas a propósito; es el patrón normal
      // de aserción, no un bug de `this` sin bindear.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['apps/api/**/*.ts', 'apps/worker/**/*.ts'],
    ...nPlugin.configs['flat/recommended-module'],
    languageOptions: {
      ...nPlugin.configs['flat/recommended-module'].languageOptions,
      globals: globals.node,
    },
    rules: {
      ...nPlugin.configs['flat/recommended-module'].rules,
      // Los entrypoints de servicio (src/index.ts) salen del proceso de forma
      // explícita en fallos fatales y en el shutdown — patrón estándar, no
      // el caso de librería que esta regla intenta prevenir.
      'n/no-process-exit': 'off',
      // "vitest" es una devDependency centralizada en la raíz del monorepo a
      // propósito (ver package.json raíz); cada paquete la usa sin
      // redeclararla.
      'n/no-extraneous-import': ['error', { allowModules: ['vitest'] }],
    },
  },
);
