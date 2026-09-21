import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Alineado con la convención de carpetas de CLAUDE.md: services/,
      // schemas/ y utils/ son la lógica de dominio (RNF-11). repositories/
      // (adaptadores de Mongo) y routes/ (wiring HTTP fino) quedan fuera del
      // umbral a propósito, no porque no se testeen.
      include: [
        'src/config.ts',
        'src/errors.ts',
        'src/modules/**/services/**/*.ts',
        'src/modules/**/schemas/**/*.ts',
        'src/modules/**/utils/**/*.ts',
      ],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
