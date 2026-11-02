import type { MuteState, PermissionRequestInfo, Session } from '@remote-harness/protocol'
import { isMutedSession } from '../live-status/logic'

/** The four events pushed when the app is in the background, announced in-app when it is in front (#472). */
export type NoticeKind = 'finished' | 'permission' | 'question' | 'plan'

export type Notice = {
  id: string
  kind: NoticeKind
  sessionId: string
  /** The session's title (its folder's name when it has none). */
  session: string
  at: number
}

/** A request older than this is not news: the daemon replays pending ones on reconnect. */
export const FRESH_MS = 60_000

/** Sessions whose turn just ended: `running` before, `idle` now (a session unknown before was not running). */
export function finishedSessions(
  previous: Readonly<Record<string, Pick<Session, 'state'>>>,
  current: Readonly<Record<string, Session>>,
): Session[] {
  return Object.values(current).filter(
    (session) => session.state === 'idle' && previous[session.id]?.state === 'running',
  )
}

/** What a new pending request announces: a question, a plan to review, else a plain permission. */
export function requestKind(request: Pick<PermissionRequestInfo, 'interaction'>): NoticeKind {
  if (request.interaction?.kind === 'question') return 'question'
  if (request.interaction?.kind === 'plan') return 'plan'
  return 'permission'
}

/** Created within the last minute: a request replayed on reconnect, or seen after switching computers, is not news. */
export function isFresh(request: Pick<PermissionRequestInfo, 'createdAt'>, now: number): boolean {
  const created = Date.parse(request.createdAt)
  return !Number.isFinite(created) || now - created < FRESH_MS
}

export type NoticeContext = {
  /** The session on screen, which shows its own events. */
  onScreen: string | null
  muted: MuteState
  demo: boolean
}

/** Whether an event of `session` gets a notice: not the session on screen, not muted (session or profile), never in the demo. */
export function announces(session: Pick<Session, 'id' | 'profileId'>, context: NoticeContext): boolean {
  if (context.demo || session.id === context.onScreen) return false
  return !isMutedSession(session, context.muted)
}

export function noticeFor(kind: NoticeKind, session: Pick<Session, 'id' | 'title'>, at: number): Notice {
  return { id: `${kind}:${session.id}:${at}`, kind, sessionId: session.id, session: session.title, at }
}
