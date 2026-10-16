import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'sql.js/dist/sql-wasm.wasm?url': path.resolve(__dirname, './tests/sqlWasmUrl.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/utils.ts',
        'src/lib/markdown.ts',
        'src/lib/storage/saveQueue.ts',
        'src/features/novel/autoSave.ts',
        'electron/protected-storage.js',
        'electron/test-profile.js',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
})
