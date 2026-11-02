import type { PermissionRequestInfo, Session } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { announces, FRESH_MS, finishedSessions, isFresh, noticeFor, requestKind } from './select'

const session = (id: string, state: Session['state'], profileId = 'p1') =>
  ({ id, state, profileId, title: `Session ${id}` }) as Session
const none = { profiles: [], sessions: [] }

describe('finishedSessions', () => {
  test('sessions that were running and are idle now', () => {
    const previous = { a: session('a', 'running'), b: session('b', 'running'), c: session('c', 'idle') }
    const current = {
      a: session('a', 'idle'),
      b: session('b', 'waiting'),
      c: session('c', 'idle'),
      d: session('d', 'idle'),
    }
    expect(finishedSessions(previous, current).map((s) => s.id)).toEqual(['a'])
  })

  test('a first snapshot announces nothing', () => {
    expect(finishedSessions({}, { a: session('a', 'idle') })).toEqual([])
  })
})

describe('requestKind', () => {
  test('question, plan, else permission', () => {
    expect(requestKind({ interaction: { kind: 'question', title: null, questions: [] } })).toBe('question')
    expect(requestKind({ interaction: { kind: 'plan', plan: null } })).toBe('plan')
    expect(requestKind({})).toBe('permission')
  })
})

describe('isFresh', () => {
  const at = Date.parse('2026-11-01T12:00:00Z')
  const request = (createdAt: string) => ({ createdAt }) as PermissionRequestInfo
  test('within the last minute, or with an unreadable time', () => {
    expect(isFresh(request('2026-11-01T11:59:30Z'), at)).toBe(true)
    expect(isFresh(request('2026-11-01T11:50:00Z'), at)).toBe(false)
    expect(isFresh(request('2026-11-01T11:59:00Z'), at)).toBe(false)
    expect(isFresh(request('2026-11-01T11:59:00.001Z'), at)).toBe(true)
    expect(isFresh(request('garbage'), at)).toBe(true)
    expect(FRESH_MS).toBe(60_000)
  })
})

describe('announces', () => {
  const s = session('a', 'idle')
  test('not the session on screen, not muted, never in the demo', () => {
    expect(announces(s, { onScreen: 'b', muted: none, demo: false })).toBe(true)
    expect(announces(s, { onScreen: null, muted: none, demo: false })).toBe(true)
    expect(announces(s, { onScreen: 'a', muted: none, demo: false })).toBe(false)
    expect(announces(s, { onScreen: 'b', muted: { profiles: [], sessions: ['a'] }, demo: false })).toBe(false)
    expect(announces(s, { onScreen: 'b', muted: { profiles: ['p1'], sessions: [] }, demo: false })).toBe(
      false,
    )
    expect(announces(s, { onScreen: 'b', muted: none, demo: true })).toBe(false)
  })
})

describe('noticeFor', () => {
  test('carries the kind, the session and its title', () => {
    expect(noticeFor('plan', session('a', 'waiting'), 5)).toEqual({
      id: 'plan:a:5',
      kind: 'plan',
      sessionId: 'a',
      session: 'Session a',
      at: 5,
    })
  })
})
