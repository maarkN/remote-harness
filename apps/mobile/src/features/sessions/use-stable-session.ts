import type { Session } from '@remote-harness/protocol'
import { useMemo } from 'react'
import { stableSessionSelector } from './stable-session'
import { useSessionsStore } from './store'

/**
 * The session, re-rendering only when something other than its status line or activity time
 * changes (see `stableSessionSelector`): its `status` and `updatedAt` may be stale.
 */
export function useStableSession(id: string): Session | undefined {
  const select = useMemo(() => stableSessionSelector(id), [id])
  return useSessionsStore(select)
}
