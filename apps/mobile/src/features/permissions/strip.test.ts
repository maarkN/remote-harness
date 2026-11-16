import type { PermissionRequestInfo, Session } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { formatElapsed } from '../../core/utils/time'
import {
  deckEdges,
  deckFront,
  deckStep,
  pendingForStrip,
  type StripItem,
  stripCandidates,
  stripItemKey,
  stripSessionId,
  swipeDelta,
} from './strip'

const session = (id: string, state: Session['state'], updatedAt: string, controllable = true) =>
  ({
    id,
    state,
    updatedAt,
    controllable,
    profileId: 'p',
    title: id,
    cwd: '/w',
    subagents: [],
  }) as unknown as Session

const request = (requestId: string, sessionId: string, createdAt: string, interaction?: 'question') =>
  ({
    requestId,
    sessionId,
    profileId: 'p',
    tool: 'Bash',
    input: { command: 'ls' },
    suggestedRule: null,
    defaultScope: 'project',
    createdAt,
    expiresAt: '2026-10-18T13:00:00Z',
    ...(interaction ? { interaction: { kind: 'question', title: 'Q', questions: [] } } : {}),
  }) as unknown as PermissionRequestInfo

describe('pendingForStrip', () => {
  test('leaves out read-only waiting sessions and requests of ended sessions (#220)', () => {
    const readOnly = session('a', 'waiting', '2026-10-18T12:00:00Z', false)
    const ended = session('b', 'ended', '2026-10-18T12:00:00Z', false)
    expect(pendingForStrip([readOnly, ended], [request('r1', 'b', '2026-10-18T12:01:00Z')])).toBeNull()
    // A request of a session the app does not know yet still shows.
    expect(pendingForStrip([], [request('r2', 'x', '2026-10-18T12:01:00Z')])?.sessions).toBe(1)
  })

  test('nothing waiting', () => {
    expect(pendingForStrip([session('a', 'running', '2026-10-18T12:00:00Z')], [])).toBeNull()
  })

  test('every item oldest first, distinct sessions counted', () => {
    const sessions = [
      session('a', 'waiting', '2026-10-18T12:05:00Z'),
      session('b', 'waiting', '2026-10-18T12:06:00Z'),
    ]
    const requests = [
      request('r2', 'b', '2026-10-18T12:03:00Z'),
      request('r1', 'a', '2026-10-18T12:01:00Z'),
      request('r3', 'a', '2026-10-18T12:04:00Z'),
    ]
    const strip = pendingForStrip(sessions, requests)
    const oldest = strip?.items[0]
    expect(oldest?.kind === 'request' && oldest.request.requestId).toBe('r1')
    expect(oldest?.kind === 'request' && oldest.session?.id).toBe('a')
    expect(strip?.sessions).toBe(2)
    expect(strip?.items.map(stripItemKey)).toEqual(['request:r1', 'request:r2', 'request:r3'])
    expect(strip?.items[1] && stripSessionId(strip.items[1])).toBe('b')
  })

  test('a waiting session without a request is listed (and not answerable inline)', () => {
    const sessions = [
      session('a', 'waiting', '2026-10-18T12:00:00Z'),
      session('b', 'idle', '2026-10-18T12:30:00Z'),
    ]
    const strip = pendingForStrip(sessions, [request('r', 'c', '2026-10-18T12:10:00Z')])
    expect(strip?.items[0]).toMatchObject({ kind: 'waiting', session: { id: 'a' } })
    expect(strip?.sessions).toBe(2)
    // A request for a session the list does not know yet still shows (session null).
    expect(strip?.items[1]).toMatchObject({ kind: 'request', session: null })
  })

  test('a waiting session that already has a request is not duplicated', () => {
    const sessions = [session('a', 'waiting', '2026-10-18T11:00:00Z')]
    const strip = pendingForStrip(sessions, [request('r', 'a', '2026-10-18T12:00:00Z')])
    expect(strip?.items).toHaveLength(1)
    expect(strip?.sessions).toBe(1)
  })
})

describe('deck', () => {
  const item = (id: string, at: string): StripItem => ({
    kind: 'request',
    request: request(id, 'a', at),
    session: null,
    since: Date.parse(at),
  })
  const [r1, r2, r3] = [
    item('r1', '2026-10-18T12:01:00Z'),
    item('r2', '2026-10-18T12:02:00Z'),
    item('r3', '2026-10-18T12:03:00Z'),
  ]
  const deck = [r1, r2, r3]

  test('item keys tell requests and waiting sessions apart', () => {
    expect(stripItemKey(r1)).toBe('request:r1')
    expect(
      stripItemKey({ kind: 'waiting', session: session('s', 'waiting', '2026-10-18T12:00:00Z'), since: 0 }),
    ).toBe('waiting:s')
  })

  test('never moved: the oldest is in front', () => {
    expect(deckFront(deck, null, 0)).toBe(0)
  })

  test('the front item stays in front when others come and go', () => {
    expect(deckFront(deck, 'request:r2', 1)).toBe(1)
    expect(deckFront([r2, r3], 'request:r2', 1)).toBe(0)
  })

  test('the front item answered: the one that took its place comes forward (#561)', () => {
    expect(deckFront([r1, r3], 'request:r2', 1)).toBe(1)
    // It was the last one: the previous comes forward.
    expect(deckFront([r1, r2], 'request:r3', 2)).toBe(1)
  })

  test('next and previous wrap around', () => {
    expect(deckStep(0, 1, 3)).toBe(1)
    expect(deckStep(2, 1, 3)).toBe(0)
    expect(deckStep(0, -1, 3)).toBe(2)
  })

  test('a swipe left brings the next, right the previous, a short one nothing', () => {
    expect(swipeDelta(-80, 0)).toBe(1)
    expect(swipeDelta(80, 0)).toBe(-1)
    expect(swipeDelta(-20, -1200)).toBe(1)
    expect(swipeDelta(30, 100)).toBe(0)
  })

  test('one edge for two items, two for three or more', () => {
    expect([1, 2, 3, 5].map(deckEdges)).toEqual([0, 1, 2, 2])
  })
})

test('formatElapsed', () => {
  expect(formatElapsed(0)).toBe('0:00')
  expect(formatElapsed(-500)).toBe('0:00')
  expect(formatElapsed(276_000)).toBe('4:36')
  expect(formatElapsed(3_725_000)).toBe('1:02:05')
})

describe('stripCandidates', () => {
  const running = session('run', 'running', '2026-10-25T12:00:00Z')
  const waiting = session('wait', 'waiting', '2026-10-25T12:00:00Z')
  const asked = session('ask', 'running', '2026-10-25T12:00:00Z')
  const all = { run: running, wait: waiting, ask: asked }

  test('keeps waiting sessions and sessions with a request', () => {
    expect(stripCandidates(all, new Set(['ask'])).map((s) => s.id)).toEqual(['wait', 'ask'])
  })

  test('gives the strip the same model as all sessions', () => {
    const requests = [request('r1', 'ask', '2026-10-25T11:59:00Z')]
    const ids = new Set(requests.map((r) => r.sessionId))
    expect(pendingForStrip(stripCandidates(all, ids), requests)).toEqual(
      pendingForStrip(Object.values(all), requests),
    )
  })
})
