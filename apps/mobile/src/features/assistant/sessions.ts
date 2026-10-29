import { isLiveSession, type Session } from '@remote-harness/protocol'

/** A session as the voice assistant offers it (Siri's session parameter). Stays on the device. */
export type AssistantSession = { id: string; title: string; state: Session['state']; updatedAt: string }

/** At most this many sessions are offered to the assistant. */
export const ASSISTANT_SESSIONS_LIMIT = 30

type Candidate = Pick<Session, 'id' | 'title' | 'state' | 'controllable' | 'updatedAt'>

function byRecency(a: Candidate, b: Candidate): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}

/** Sessions that can receive a prompt: waiting for the user first, then the most recent. */
export function assistantSessions(sessions: readonly Candidate[]): AssistantSession[] {
  return sessions
    .filter(isLiveSession)
    .sort((a, b) => Number(b.state === 'waiting') - Number(a.state === 'waiting') || byRecency(a, b))
    .slice(0, ASSISTANT_SESSIONS_LIMIT)
    .map(({ id, title, state, updatedAt }) => ({ id, title, state, updatedAt }))
}

/** The session a reply goes to when none was named: the most recent waiting one, else the most recent live one. */
export function defaultSession<T extends Candidate>(sessions: readonly T[]): T | null {
  const live = sessions.filter(isLiveSession).sort(byRecency)
  return live.find((s) => s.state === 'waiting') ?? live[0] ?? null
}
