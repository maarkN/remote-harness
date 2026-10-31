import { historyDb } from '@/core/storage/history'
import { useSessionsStore } from '@/features/sessions/store'

/** A changed session list is written to the cache once it has been quiet this long. */
const SAVE_DELAY_MS = 3_000

/**
 * Keeps a computer's last session list in the history cache: shown when the app starts and no
 * snapshot has arrived yet (the computer may be unreachable), saved again as the list changes.
 * Returns a function that stops it.
 */
export function bindSessionSnapshot(computer: string): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const db = historyDb()

  void db.then(async (history) => {
    const saved = history ? await history.snapshot(computer).catch(() => null) : null
    if (stopped || !saved || useSessionsStore.getState().loaded) return
    useSessionsStore.setState({
      sessions: Object.fromEntries(saved.sessions.map((s) => [s.id, s])),
      loaded: true,
      lastFetchedAt: saved.fetchedAt,
    })
  })

  const unsubscribe = useSessionsStore.subscribe((state, previous) => {
    if (state.sessions === previous.sessions || !state.lastFetchedAt) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      const { sessions, lastFetchedAt } = useSessionsStore.getState()
      if (stopped || !lastFetchedAt) return
      void db.then((history) =>
        history?.saveSnapshot(computer, Object.values(sessions), lastFetchedAt).catch(() => undefined),
      )
    }, SAVE_DELAY_MS)
  })

  return () => {
    stopped = true
    clearTimeout(timer)
    unsubscribe()
  }
}
