import * as SecureStore from 'expo-secure-store'

/**
 * Reads `key`; when it is absent, reads `legacyKey` instead and, if that has a value, adopts it
 * under `key` so the next read skips the legacy lookup. Returns `null` when neither has a value.
 */
export async function readMigratedKey(key: string, legacyKey: string): Promise<string | null> {
  const current = await SecureStore.getItemAsync(key).catch(() => null)
  if (current !== null) return current
  const legacy = await SecureStore.getItemAsync(legacyKey).catch(() => null)
  if (legacy === null) return null
  await SecureStore.setItemAsync(key, legacy).catch(() => undefined)
  return legacy
}
