import type { Session } from '@remote-harness/protocol'

type SessionsState = { sessions: Record<string, Session> }

/** The session without the fields that change while it merely works (status line, activity time). */
function shapeKey(session: Session): string {
  const { status: _status, updatedAt: _updatedAt, ...rest } = session
  return JSON.stringify(rest)
}

/**
 * Selector of one session that keeps returning the same object while only its status line or its
 * activity time changed, so screens that show neither (the session route, the composer, the
 * inspector) do not re-render on every context-token or activity tick. Its `status` and
 * `updatedAt` may therefore be stale: read those from the store directly.
 */
export function stableSessionSelector(id: string): (state: SessionsState) => Session | undefined {
  let last: Session | undefined
  let lastKey: string | null = null
  return (state) => {
    const session = state.sessions[id]
    if (session === last) return last
    if (!session) {
      last = undefined
      lastKey = null
      return undefined
    }
    const key = shapeKey(session)
    if (last && key === lastKey) return last
    last = session
    lastKey = key
    return session
  }
}
