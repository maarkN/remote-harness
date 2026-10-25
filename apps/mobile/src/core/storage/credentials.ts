import * as SecureStore from 'expo-secure-store'
import { type Computer, parseStoredComputer, serializeComputer } from './computer'

export type { Computer } from './computer'

const KEY = 'remote-harness.computer'
/** The `{host, port, token}` item of protocol 1, deleted at start (ADR-0002: pair again). */
const LEGACY_KEY = 'claude-remote.credentials'

const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

/** The paired computer's keys live only in SecureStore (iOS Keychain / Android Keystore), on this device. */
export const credentialsStorage = {
  async load(): Promise<Computer | null> {
    const stored = parseStoredComputer(await SecureStore.getItemAsync(KEY, options))
    return stored.kind === 'computer' ? stored.computer : null
  },
  async save(computer: Computer): Promise<void> {
    await SecureStore.setItemAsync(KEY, serializeComputer(computer), options)
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY, options)
  },
  /** Deletes a protocol-1 pairing; true when there was one (the pairing screen then says why). */
  async dropLegacy(): Promise<boolean> {
    const legacy = parseStoredComputer(await SecureStore.getItemAsync(LEGACY_KEY))
    if (legacy.kind === 'none') return false
    await SecureStore.deleteItemAsync(LEGACY_KEY)
    return true
  },
}
