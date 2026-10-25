import { describe, expect, test } from 'vitest'
import {
  applyPaneDiff,
  applySessionDelta,
  diffPaneFrames,
  diffSessions,
  normalizeChannelClose,
  relayCloseCode,
  type Session,
  SessionSchema,
} from '../src/index.ts'

const session: Session = {
  id: 's',
  profileId: 'claudin',
  cwd: '/tmp',
  title: 'x',
  state: 'idle',
  permissionMode: 'default',
  approvalPolicy: null,
  controllable: true,
  paneId: '%1',
  updatedAt: '2026-10-14T00:00:00Z',
  subagents: [],
  backgroundTasks: 0,
  checkout: { root: '/tmp', branch: 'main' },
  status: { model: 'Opus 5.5', effort: 'high', context: { usedTokens: 124_000, size: 200_000, percent: 62 } },
}

describe('pane diffs', () => {
  const screen = (lines: string[]) => ({ text: lines.join('\n'), cols: 80, rows: lines.length })
  const base = screen(Array.from({ length: 40 }, (_, i) => `line ${i}`))

  test('a few changed lines become a diff that rebuilds the frame', () => {
    const lines = base.text.split('\n')
    lines[39] = '$ pnpm test'
    lines[3] = '\u001b[32mok\u001b[0m'
    const next = { ...base, text: lines.join('\n') }
    const diff = diffPaneFrames(base, next)
    expect(diff?.lines).toEqual([
      [3, '\u001b[32mok\u001b[0m'],
      [39, '$ pnpm test'],
    ])
    expect(applyPaneDiff(base, diff as NonNullable<typeof diff>)).toEqual(next)
  })

  test('full frames for the first frame, a resize and a mostly new screen', () => {
    expect(diffPaneFrames(null, base)).toBeNull()
    expect(diffPaneFrames(base, { ...base, cols: 100 })).toBeNull()
    const cleared = screen(Array.from({ length: 40 }, (_, i) => `new ${i}`))
    expect(diffPaneFrames(base, cleared)).toBeNull()
  })

  test('shorter and longer screens', () => {
    const shorter = { ...base, text: base.text.split('\n').slice(0, 38).join('\n') }
    const diff = diffPaneFrames(base, shorter)
    expect(diff?.lineCount).toBe(38)
    expect(applyPaneDiff(base, diff as NonNullable<typeof diff>)).toEqual(shorter)
    const longer = { ...base, text: `${base.text}\nmore` }
    const grow = diffPaneFrames(base, longer)
    expect(applyPaneDiff(base, grow as NonNullable<typeof grow>)).toEqual(longer)
  })
})

describe('session deltas', () => {
  test('only changed fields, and nothing when nothing changed', () => {
    expect(diffSessions(session, { ...session })).toBeNull()
    const next = { ...session, state: 'running' as const, updatedAt: '2026-10-14T00:01:00Z' }
    expect(diffSessions(session, next)).toEqual({
      set: { state: 'running', updatedAt: '2026-10-14T00:01:00Z' },
      unset: [],
    })
  })

  test('nested values compare by content; removed optional fields are unset', () => {
    const next = { ...session, status: { ...session.status } } as Session
    expect(diffSessions(session, next)).toBeNull()
    const { checkout: _gone, ...withoutCheckout } = session
    const delta = diffSessions(session, withoutCheckout as Session)
    expect(delta).toEqual({ set: {}, unset: ['checkout'] })
    // An unset field reads as the schema's value for a missing one, as on a full update.
    expect(applySessionDelta(session, delta as NonNullable<typeof delta>)).toEqual(
      SessionSchema.parse(withoutCheckout),
    )
  })

  test('applying a delta gives the next session; an invalid result is refused', () => {
    const next = { ...session, title: 'renamed', subagents: [] }
    expect(applySessionDelta(session, diffSessions(session, next) as never)).toEqual(next)
    expect(applySessionDelta(session, { set: { state: 'flying' }, unset: [] })).toBeNull()
  })
})

describe('relay close codes', () => {
  test('daemon codes travel as 41xx and read back', () => {
    expect(relayCloseCode(4001)).toBe(4101)
    expect(relayCloseCode(4007)).toBe(4107)
    expect(relayCloseCode(1009)).toBe(4100)
    expect(normalizeChannelClose(4101)).toBe(4001)
    expect(normalizeChannelClose(4001)).toBe(4001)
    expect(normalizeChannelClose(4004)).toBe(4004)
    expect(normalizeChannelClose(1012)).toBe(1012)
  })
})

describe('pane scroll', () => {
  test('a log that scrolled is a shift plus the new lines', () => {
    const log = (from: number) => ({
      text: Array.from({ length: 40 }, (_, i) => `ok module-${from + i}`).join('\n'),
      cols: 80,
      rows: 40,
    })
    const diff = diffPaneFrames(log(0), log(2))
    expect(diff).toMatchObject({
      scroll: 2,
      lines: [
        [38, 'ok module-40'],
        [39, 'ok module-41'],
      ],
    })
    expect(applyPaneDiff(log(0), diff as NonNullable<typeof diff>)).toEqual(log(2))
  })
})
