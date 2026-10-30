import { NOISE_TEST_VECTORS, runNoiseVector } from '@remote-harness/protocol/noise-test-vectors'
import { describe, expect, test } from 'vitest'
import { noiseCrypto } from '.'

// In Vitest `react-native-quick-crypto` resolves to node:crypto (same API, see vitest.config.ts),
// so this runs the app's own adapter against the official vectors.
describe('Noise vectors with the app adapter', () => {
  test.each(NOISE_TEST_VECTORS.map((v) => [v.protocol_name, v] as const))('%s', (_name, vector) => {
    expect(runNoiseVector(noiseCrypto, vector)).toEqual([])
  })
})
