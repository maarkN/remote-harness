import type { PermissionOutcome, PermissionRequestInfo } from '@remote-harness/protocol'
import { create } from 'zustand'
import type { DaemonClient } from '@/core/connection/daemon-client'

type Resolved = { requestId: string; sessionId: string; outcome: PermissionOutcome; at: number }

type PermissionsState = {
  pending: Record<string, PermissionRequestInfo>
  lastResolved: Resolved | null
}

export const usePermissionsStore = create<PermissionsState>(() => ({ pending: {}, lastResolved: null }))

export function selectPendingFor(sessionId: string) {
  return (s: PermissionsState) => Object.values(s.pending).filter((p) => p.sessionId === sessionId)
}

export function selectPendingCounts(s: PermissionsState): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of Object.values(s.pending)) counts[p.sessionId] = (counts[p.sessionId] ?? 0) + 1
  return counts
}

/**
 * Mirrors pending permission requests. The daemon replays them on every (re)connect, maybe before
 * the stores listen or before the app sees the connection as ready (#384): on ready, and when bound
 * to a connection already open, the app takes the daemon's list of waiting requests instead.
 */
export function bindPermissions(
  client: DaemonClient,
  onNewRequest?: (info: PermissionRequestInfo) => void,
): () => void {
  // Requests the daemon sent since the connection was last lost (what an older daemon replayed).
  let seen = new Set<string>()
  const replace = (requests: PermissionRequestInfo[]) =>
    usePermissionsStore.setState({ pending: Object.fromEntries(requests.map((r) => [r.requestId, r])) })
  const sync = (reconnected: boolean) =>
    client.request({ type: 'permissions.list' }).then(
      (reply) => {
        if (reply.type === 'permissions.result') replace(reply.requests)
      },
      () => {
        // Older daemons have no list: after a reconnect, keep only what this connection sent again.
        if (!reconnected || client.status !== 'open') return
        replace(Object.values(usePermissionsStore.getState().pending).filter((p) => seen.has(p.requestId)))
      },
    )
  const offs = [
    client.onStatus((status) => {
      if (status !== 'open') seen = new Set()
    }),
    client.onReady(() => void sync(true)),
    // A request sent again (handed over to the terminal) replaces its data without a new haptic.
    client.on('permission.request', ({ request }) => {
      seen.add(request.requestId)
      const known = request.requestId in usePermissionsStore.getState().pending
      usePermissionsStore.setState((s) => ({ pending: { ...s.pending, [request.requestId]: request } }))
      if (!known) onNewRequest?.(request)
    }),
    client.on('permission.resolved', ({ requestId, sessionId, outcome }) => {
      usePermissionsStore.setState((s) => {
        const { [requestId]: _done, ...rest } = s.pending
        return { pending: rest, lastResolved: { requestId, sessionId, outcome, at: Date.now() } }
      })
    }),
  ]
  if (client.status === 'open') void sync(false)
  return () => {
    for (const off of offs) off()
  }
}
