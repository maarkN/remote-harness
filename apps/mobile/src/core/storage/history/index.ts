import type { HistoryDb } from './history-db'
import { openHistoryDb } from './open'

export type { CachedPage, HistoryEvent } from './history-db'
export { HistoryDb } from './history-db'

let opening: Promise<HistoryDb | null> | null = null

/**
 * The device's history cache, opened on first use. Null when it cannot be opened (the app then
 * works from memory only, as before the cache).
 */
export function historyDb(): Promise<HistoryDb | null> {
  opening ??= openHistoryDb().catch(() => null)
  return opening
}

/** Deletes everything cached for a computer (forgotten on this device, or the device revoked). */
export async function wipeHistory(daemonId: string): Promise<void> {
  const db = await historyDb()
  await db?.wipe(daemonId)
}
