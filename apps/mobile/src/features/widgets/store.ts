import * as SecureStore from 'expo-secure-store'
import { parseSnapshot, type WidgetSnapshot } from './logic'

const KEY = 'remote-harness.widgets'
// Read by background tasks (refresh pushes, widget taps) with the phone locked, never restored elsewhere.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** The last snapshot the widgets got (null before the first one or when unreadable). */
export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  return parseSnapshot(await SecureStore.getItemAsync(KEY, OPTIONS).catch(() => null))
}

let pending: Promise<void> = Promise.resolve()

/** Saves the snapshot; writes run in order, the last one wins. */
export function saveSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const value = JSON.stringify(snapshot)
  pending = pending.then(() => SecureStore.setItemAsync(KEY, value, OPTIONS)).catch(() => undefined)
  return pending
}
