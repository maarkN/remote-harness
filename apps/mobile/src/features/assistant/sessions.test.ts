import { describe, expect, it } from 'vitest'
import { ASSISTANT_SESSIONS_LIMIT, assistantSessions, defaultSession } from './sessions'

type Candidate = Parameters<typeof assistantSessions>[0][number]

const session = (id: string, patch: Partial<Candidate> = {}): Candidate => ({
  id,
  title: `Session ${id}`,
  state: 'idle',
  controllable: true,
  updatedAt: '2026-10-28T10:00:00.000Z',
  ...patch,
})

describe('assistantSessions', () => {
  it('keeps only live sessions, waiting first, then the most recent', () => {
    const list = assistantSessions([
      session('old', { updatedAt: '2026-10-28T09:00:00.000Z' }),
      session('ended', { state: 'ended', updatedAt: '2026-10-28T12:00:00.000Z' }),
      session('readonly', { controllable: false, updatedAt: '2026-10-28T12:00:00.000Z' }),
      session('new', { state: 'running', updatedAt: '2026-10-28T11:00:00.000Z' }),
      session('waiting', { state: 'waiting', updatedAt: '2026-10-28T08:00:00.000Z' }),
    ])
    expect(list.map((s) => s.id)).toEqual(['waiting', 'new', 'old'])
  })

  it('keeps only id, title, state and update time', () => {
    expect(assistantSessions([session('a')])[0]).toEqual({
      id: 'a',
      title: 'Session a',
      state: 'idle',
      updatedAt: '2026-10-28T10:00:00.000Z',
    })
  })

  it('caps the list', () => {
    const many = Array.from({ length: ASSISTANT_SESSIONS_LIMIT + 5 }, (_, i) => session(String(i)))
    expect(assistantSessions(many)).toHaveLength(ASSISTANT_SESSIONS_LIMIT)
  })
})

describe('defaultSession', () => {
  it('prefers the most recent session waiting for the user', () => {
    const chosen = defaultSession([
      session('running', { state: 'running', updatedAt: '2026-10-28T12:00:00.000Z' }),
      session('waiting-old', { state: 'waiting', updatedAt: '2026-10-28T08:00:00.000Z' }),
      session('waiting-new', { state: 'waiting', updatedAt: '2026-10-28T09:00:00.000Z' }),
    ])
    expect(chosen?.id).toBe('waiting-new')
  })

  it('falls back to the most recent live session', () => {
    const chosen = defaultSession([
      session('a', { updatedAt: '2026-10-28T08:00:00.000Z' }),
      session('b', { state: 'running', updatedAt: '2026-10-28T09:00:00.000Z' }),
      session('c', { state: 'ended', updatedAt: '2026-10-28T10:00:00.000Z' }),
    ])
    expect(chosen?.id).toBe('b')
  })

  it('is null without a live session', () => {
    expect(defaultSession([session('x', { controllable: false })])).toBeNull()
  })
})
