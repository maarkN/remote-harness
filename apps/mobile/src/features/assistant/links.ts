import { isLiveSession, type Session } from '@remote-harness/protocol'

/**
 * What an assistant link asks for (`remoteharness://assistant/<action>`, from Google Assistant App
 * Actions and the launcher shortcuts). A reply without text only opens the session to type.
 */
export type AssistantLink =
  | { kind: 'reply'; text: string; sessionId?: string; sessionTitle?: string }
  | { kind: 'answer'; decision: 'allow' | 'deny' }
  | { kind: 'waiting' }

type Params = Record<string, string | string[] | undefined>

function param(params: Params, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

/** Parses the route's action and query; `null` for anything unknown. */
export function parseAssistantLink(action: string, params: Params): AssistantLink | null {
  switch (action) {
    case 'reply': {
      const sessionId = param(params, 'sessionId')
      const sessionTitle = param(params, 'session')
      return {
        kind: 'reply',
        text: param(params, 'text'),
        ...(sessionId ? { sessionId } : {}),
        ...(sessionTitle ? { sessionTitle } : {}),
      }
    }
    case 'answer': {
      const decision = param(params, 'decision')
      return decision === 'allow' || decision === 'deny' ? { kind: 'answer', decision } : null
    }
    case 'waiting':
      return { kind: 'waiting' }
    default:
      return null
  }
}

/**
 * The live session a spoken title names: the same title ignoring case and accents, else the only
 * live session whose title contains it. `null` when none or several match.
 */
export function sessionByTitle<T extends Pick<Session, 'title' | 'state' | 'controllable'>>(
  sessions: readonly T[],
  title: string,
): T | null {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
  const wanted = normalize(title)
  if (!wanted) return null
  const live = sessions.filter(isLiveSession)
  const exact = live.filter((s) => normalize(s.title) === wanted)
  if (exact.length === 1) return exact[0] ?? null
  if (exact.length > 1) return null
  const partial = live.filter((s) => normalize(s.title).includes(wanted))
  return partial.length === 1 ? (partial[0] ?? null) : null
}
