import { useConnectionStore } from '@/core/connection/connection-store'
import { type HistoryDb, historyDb } from '@/core/storage/history'

/** The history cache and the computer (daemon ID) a subscription reads and writes it for. */
export type HistoryTarget = { db: HistoryDb; computer: string }

/** The cache for the active computer; null without one, in the offline demo, or when it cannot open. */
export async function activeHistory(): Promise<HistoryTarget | null> {
  const { activeId, demo } = useConnectionStore.getState()
  if (!activeId || demo) return null
  const db = await historyDb()
  return db ? { db, computer: activeId } : null
}
