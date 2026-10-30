import * as SecureStore from 'expo-secure-store'
import {
  activateInIndex,
  addToIndex,
  type Computer,
  type ComputersIndex,
  parseIndex,
  parseStoredComputer,
  removeFromIndex,
  serializeComputer,
} from './computer'

export type { Computer } from './computer'

const INDEX_KEY = 'remote-harness.computers'
const itemKey = (daemonId: string) => `remote-harness.computer.${daemonId}`
/** The single computer of the previous version, moved into the list on the first start. */
const SINGLE_KEY = 'remote-harness.computer'
/** The `{host, port, token}` item of protocol 1, deleted at start (ADR-0002: pair again). */
const LEGACY_KEY = 'claude-remote.credentials'

const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

async function readIndex(): Promise<ComputersIndex> {
  return parseIndex(await SecureStore.getItemAsync(INDEX_KEY, options))
}

async function writeIndex(index: ComputersIndex): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(index), options)
}

/**
 * The paired computers' keys live only in SecureStore (iOS Keychain / Android Keystore), on this
 * device: one item per computer (values stay small) and an index with the active one.
 */
export const credentialsStorage = {
  async loadAll(): Promise<{ computers: Computer[]; active: string | null }> {
    let index = await readIndex()
    const single = parseStoredComputer(await SecureStore.getItemAsync(SINGLE_KEY, options))
    if (single.kind === 'computer') {
      await SecureStore.setItemAsync(
        itemKey(single.computer.daemonId),
        serializeComputer(single.computer),
        options,
      )
      index = addToIndex(index, single.computer.daemonId)
      await writeIndex(index)
      await SecureStore.deleteItemAsync(SINGLE_KEY, options)
    }
    const computers: Computer[] = []
    for (const id of index.ids) {
      const stored = parseStoredComputer(await SecureStore.getItemAsync(itemKey(id), options))
      if (stored.kind === 'computer') computers.push(stored.computer)
    }
    const known = new Set(computers.map((c) => c.daemonId))
    const active = index.active && known.has(index.active) ? index.active : (computers[0]?.daemonId ?? null)
    return { computers, active }
  },
  /** Saves a computer; `activate` puts it first and makes it the active one (pairing, switching). */
  async save(computer: Computer, activate = false): Promise<void> {
    await SecureStore.setItemAsync(itemKey(computer.daemonId), serializeComputer(computer), options)
    const index = await readIndex()
    if (activate || !index.ids.includes(computer.daemonId))
      await writeIndex(addToIndex(index, computer.daemonId))
  },
  async activate(daemonId: string): Promise<void> {
    await writeIndex(activateInIndex(await readIndex(), daemonId))
  },
  /** Deletes a computer's keys; returns the computer that is active afterwards (null when none). */
  async remove(daemonId: string): Promise<string | null> {
    await SecureStore.deleteItemAsync(itemKey(daemonId), options)
    const index = removeFromIndex(await readIndex(), daemonId)
    await writeIndex(index)
    return index.active
  },
  /** Deletes a protocol-1 pairing; true when there was one (the pairing screen then says why). */
  async dropLegacy(): Promise<boolean> {
    const legacy = parseStoredComputer(await SecureStore.getItemAsync(LEGACY_KEY))
    if (legacy.kind === 'none') return false
    await SecureStore.deleteItemAsync(LEGACY_KEY)
    return true
  },
}
