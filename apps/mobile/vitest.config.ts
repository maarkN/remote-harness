import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Only pure TypeScript (no react-native imports) is unit-tested here. react-native-quick-crypto
// implements Node's `crypto` API, so node:crypto stands in for it (`src/core/crypto`).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'react-native-quick-crypto': 'node:crypto',
    },
  },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
})
