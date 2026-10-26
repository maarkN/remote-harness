import type { ChangedFile } from '@remote-harness/protocol'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DaemonRequestError, useDaemonClient, useIsConnected } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { useSessionsStore } from '@/features/sessions/store'
import { refreshDue } from './logic'

/** At most one automatic refresh this often while the session keeps changing. */
const REFRESH_INTERVAL_MS = 3000

export type FileDiff = { lines: string[]; total: number; loading: boolean; error: string | null }

type ChangesState = { root: string | null; branch: string | null; files: ChangedFile[] }

/**
 * A session's working-tree changes (`changes.list`) and the diffs loaded so far (`changes.diff`, a
 * page at a time). Refreshes when the session changes, throttled; diffs of files that changed are
 * dropped so they load again.
 */
export function useChanges(sessionId: string) {
  const { t } = useTranslation()
  const client = useDaemonClient()
  const connected = useIsConnected()
  const sessionStamp = useSessionsStore((s) => {
    const session = s.sessions[sessionId]
    return session ? `${session.updatedAt}|${session.state}` : ''
  })
  const [changes, setChanges] = useState<ChangesState | null>(null)
  const [diffs, setDiffs] = useState<Record<string, FileDiff>>({})
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const lastAt = useRef<number | null>(null)
  const filesRef = useRef<ChangedFile[]>([])
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refresh = useCallback(async () => {
    if (!client) return
    lastAt.current = Date.now()
    setRefreshing(true)
    try {
      const reply = await client.request({ type: 'changes.list', sessionId })
      if (reply.type !== 'changes.result') return
      // A file whose counts or status moved has a new diff: load it again when shown.
      const before = new Map(filesRef.current.map((f) => [f.path, f]))
      const unchanged = (path: string) => {
        const now = reply.files.find((f) => f.path === path)
        const was = before.get(path)
        return (
          !!now &&
          !!was &&
          now.added === was.added &&
          now.deleted === was.deleted &&
          now.status === was.status
        )
      }
      filesRef.current = reply.files
      setDiffs((current) => Object.fromEntries(Object.entries(current).filter(([path]) => unchanged(path))))
      setChanges({ root: reply.root, branch: reply.branch, files: reply.files })
      setError(null)
    } catch (e) {
      if (e instanceof DaemonRequestError && e.code === 'unknown_type') setSupported(false)
      else setError(errorMessage(e, t))
    } finally {
      setRefreshing(false)
    }
  }, [client, sessionId, t])

  useEffect(() => {
    if (connected) void refresh()
  }, [connected, refresh])

  // The session moved (a tool ran, a turn ended): refresh, at most once per interval.
  useEffect(() => {
    if (!connected || !sessionStamp || lastAt.current === null) return
    const now = Date.now()
    clearTimeout(pending.current)
    const wait = refreshDue(lastAt.current, now, REFRESH_INTERVAL_MS)
      ? 0
      : REFRESH_INTERVAL_MS - (now - lastAt.current)
    pending.current = setTimeout(() => void refresh(), wait)
    return () => clearTimeout(pending.current)
  }, [sessionStamp, connected, refresh])

  const loadDiff = useCallback(
    async (path: string, more = false) => {
      if (!client) return
      const current = diffs[path]
      if (current?.loading || (current && !more)) return
      const offset = more && current ? current.lines.length : 0
      setDiffs((d) => ({
        ...d,
        [path]: { lines: current?.lines ?? [], total: current?.total ?? 0, loading: true, error: null },
      }))
      try {
        const reply = await client.request({ type: 'changes.diff', sessionId, path, offset })
        if (reply.type !== 'changes.diffResult') return
        setDiffs((d) => ({
          ...d,
          [path]: {
            lines: offset === 0 ? reply.lines : [...(d[path]?.lines ?? []), ...reply.lines],
            total: reply.total,
            loading: false,
            error: null,
          },
        }))
      } catch (e) {
        setDiffs((d) => ({
          ...d,
          [path]: {
            lines: d[path]?.lines ?? [],
            total: d[path]?.total ?? 0,
            loading: false,
            error: errorMessage(e, t),
          },
        }))
      }
    },
    [client, diffs, sessionId, t],
  )

  return { changes, diffs, supported, error, refreshing, refresh, loadDiff }
}
