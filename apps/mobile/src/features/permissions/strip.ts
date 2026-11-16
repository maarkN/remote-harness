import type { PermissionRequestInfo, Session } from '@remote-harness/protocol'

/** One thing waiting for the user: a pending request, or a waiting session with nothing to answer. */
export type StripItem =
  | { kind: 'request'; request: PermissionRequestInfo; session: Session | null; since: number }
  | { kind: 'waiting'; session: Session; since: number }

export type StripModel = {
  /** Distinct sessions waiting (several requests in one session count once). */
  sessions: number
  /** Every item, oldest first; never empty. With two or more the strip is a deck (#561). */
  items: [StripItem, ...StripItem[]]
}

/**
 * What the "Waiting for you" strip shows: every pending request of a session that has not ended,
 * plus every controllable `waiting` session without a request in the store, oldest first. A
 * read-only session cannot be answered from the phone, and an ended one waits for nobody (older
 * daemons could leave both marked `waiting`). `null` when nothing waits.
 */
export function pendingForStrip(
  sessions: readonly Session[],
  allRequests: readonly PermissionRequestInfo[],
): StripModel | null {
  const byId = new Map(sessions.map((session) => [session.id, session]))
  const requests = allRequests.filter((request) => byId.get(request.sessionId)?.state !== 'ended')
  const withRequest = new Set(requests.map((request) => request.sessionId))
  const items: StripItem[] = [
    ...requests.map(
      (request): StripItem => ({
        kind: 'request',
        request,
        session: byId.get(request.sessionId) ?? null,
        since: Date.parse(request.createdAt),
      }),
    ),
    ...sessions
      .filter(
        (session) => session.state === 'waiting' && session.controllable && !withRequest.has(session.id),
      )
      .map((session): StripItem => ({ kind: 'waiting', session, since: Date.parse(session.updatedAt) })),
  ].sort((a, b) => a.since - b.since)
  const [oldest, ...rest] = items
  if (!oldest) return null
  const ids = new Set(items.map(stripSessionId))
  return { sessions: ids.size, items: [oldest, ...rest] }
}

/**
 * The only sessions `pendingForStrip` looks at: the waiting ones and those with a pending request.
 * Selected with a shallow comparison, so the strip does not re-render when other sessions work.
 */
export function stripCandidates(
  sessions: Readonly<Record<string, Session>>,
  requestSessionIds: ReadonlySet<string>,
): Session[] {
  return Object.values(sessions).filter(
    (session) => session.state === 'waiting' || requestSessionIds.has(session.id),
  )
}

export function stripSessionId(item: StripItem): string {
  return item.kind === 'request' ? item.request.sessionId : item.session.id
}

/** Stable identity of an item while it waits: its request, or the waiting session without one. */
export function stripItemKey(item: StripItem): string {
  return item.kind === 'request' ? `request:${item.request.requestId}` : `waiting:${item.session.id}`
}

/**
 * Index of the deck's front card. `key` is the item the user brought forward (`null` until they
 * move, so the oldest stays in front) and `index` where it was: while it waits it stays in front;
 * once answered or resolved the item that took its place comes forward, or the previous one when
 * it was the last.
 */
export function deckFront(items: readonly StripItem[], key: string | null, index: number): number {
  if (key === null) return 0
  const found = items.findIndex((item) => stripItemKey(item) === key)
  if (found >= 0) return found
  return Math.max(0, Math.min(index, items.length - 1))
}

/** The next (`1`) or previous (`-1`) card, wrapping around the deck. */
export function deckStep(index: number, delta: 1 | -1, length: number): number {
  return length > 0 ? (index + delta + length) % length : 0
}

/** Card edges peeking below the front card: none for one item, one for two, two for more. */
export function deckEdges(length: number): number {
  return Math.max(0, Math.min(length - 1, 2))
}

/** Sideways distance (pt) or speed (pt/s) past which a swipe on the front card moves the deck. */
const SWIPE_DISTANCE = 64
const SWIPE_VELOCITY = 800

/** A released swipe on the front card: left brings the next item (`1`), right the previous (`-1`). */
export function swipeDelta(translationX: number, velocityX: number): -1 | 0 | 1 {
  'worklet'
  if (translationX <= -SWIPE_DISTANCE || velocityX <= -SWIPE_VELOCITY) return 1
  if (translationX >= SWIPE_DISTANCE || velocityX >= SWIPE_VELOCITY) return -1
  return 0
}
