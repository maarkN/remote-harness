import type { ConnectionStatus } from '@/core/connection/daemon-client'

export type UnreachableView = 'none' | 'full' | 'compact'

/**
 * Whether to show the "computer unreachable" state in place of the session list: the full
 * checklist when there is nothing cached to show, a compact notice above a stale list otherwise.
 * `reconnecting` + `unreachable` already excludes a token rejection and a brief reconnect (#326).
 */
export function unreachableView(
  status: ConnectionStatus,
  unreachable: boolean,
  hasSessions: boolean,
): UnreachableView {
  if (status !== 'reconnecting' || !unreachable) return 'none'
  return hasSessions ? 'compact' : 'full'
}
