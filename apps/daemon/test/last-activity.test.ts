import { join } from 'node:path'
import type { TranscriptEntry } from '@remote-harness/protocol'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { silentLogger } from '../src/core/logger.ts'
import { LastActivityTracker, type TailReader } from '../src/features/last-activity/tracker.ts'
import { SessionStore } from '../src/features/sessions/store.ts'
import type { SessionRecord } from '../src/features/sessions/types.ts'
import { useTempHome } from './helpers.ts'

const home = useTempHome()
const STAMP = '2026-10-31T10:00:00.000Z'

function record(id: string): SessionRecord {
  return {
    id,
    profileId: 'p',
    cwd: '/repo',
    title: 't',
    state: 'running',
    permissionMode: null,
    approvalPolicy: null,
    permissionProfile: null,
    controllable: true,
    paneId: '%1',
    updatedAt: STAMP,
    subagents: [],
    backgroundTasks: 0,
    lastActivity: null,
    checkout: null,
    status: null,
    transcriptPath: '/repo/t.jsonl',
  }
}

const reply = (text: string, isSidechain = false): TranscriptEntry => ({
  key: `${text}:0`,
  cursor: 0,
  index: 0,
  uuid: text,
  timestamp: '2026-10-31T09:59:00.000Z',
  isSidechain,
  kind: 'assistant_text',
  text,
})

function setup(read: TailReader) {
  const broadcasts: unknown[] = []
  const store = new SessionStore(
    { broadcast: (m) => broadcasts.push(m) },
    join(home.dir(), 's.json'),
    silentLogger,
    60_000,
  )
  const tracker = new LastActivityTracker(store, read, silentLogger, 3_000, {
    now: Date.now,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
  })
  store.onChange((next, previous) => {
    if (LastActivityTracker.isActivity(next, previous)) tracker.request(next.id)
  })
  return { store, tracker, broadcasts }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('LastActivityTracker', () => {
  test('fills a new session without moving updatedAt', async () => {
    vi.useFakeTimers()
    const { store, tracker } = setup(async () => ({
      entries: [reply('Done, **pool** at 20.')],
      complete: true,
    }))
    store.upsert('s', { updatedAt: STAMP }, () => record('s'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(store.get('s')?.lastActivity).toEqual({
      kind: 'assistant',
      text: 'Done, pool at 20.',
      at: '2026-10-31T09:59:00.000Z',
    })
    expect(store.get('s')?.updatedAt).toBe(STAMP)
    tracker.dispose()
    store.dispose()
  })

  test('throttles a burst and keeps a trailing refresh', async () => {
    vi.useFakeTimers({ now: Date.parse(STAMP) })
    let text = 'first'
    const read = vi.fn<TailReader>(async () => ({ entries: [reply(text)], complete: true }))
    const { store, tracker } = setup(read)
    store.upsert('s', { updatedAt: STAMP }, () => record('s'))
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(1)
    for (let i = 1; i <= 10; i++) {
      text = `step ${i}`
      store.upsert('s', { updatedAt: new Date(Date.parse(STAMP) + i * 1_000).toISOString() })
      await vi.advanceTimersByTimeAsync(1_000)
    }
    await vi.advanceTimersByTimeAsync(20_000)
    // Reads at 0, 3, 6 and 9 s, and the trailing one at 12 s.
    expect(read.mock.calls.length).toBeLessThanOrEqual(5)
    expect(store.get('s')?.lastActivity?.text).toBe('step 10')
    tracker.dispose()
    store.dispose()
  })

  test('tries a larger window when the first one holds nothing', async () => {
    vi.useFakeTimers()
    const read = vi.fn<TailReader>(async (_session, bytes) =>
      bytes > 64 * 1024 ? { entries: [reply('found')], complete: true } : { entries: [], complete: false },
    )
    const { store, tracker } = setup(read)
    store.upsert('s', { updatedAt: STAMP }, () => record('s'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(read).toHaveBeenCalledTimes(2)
    expect(store.get('s')?.lastActivity?.text).toBe('found')
    tracker.dispose()
    store.dispose()
  })

  test('keeps the previous value when the tail has nothing, and skips sessions without a transcript', async () => {
    vi.useFakeTimers()
    const read = vi.fn<TailReader>(async () => ({ entries: [reply('sub', true)], complete: true }))
    const { store, tracker } = setup(read)
    const kept = { kind: 'user' as const, text: 'before', at: STAMP }
    store.upsert('s', { updatedAt: STAMP }, () => ({ ...record('s'), lastActivity: kept }))
    store.upsert('n', { updatedAt: STAMP }, () => ({ ...record('n'), transcriptPath: null }))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(store.get('s')?.lastActivity).toEqual(kept)
    expect(read).toHaveBeenCalledTimes(1)
    tracker.dispose()
    store.dispose()
  })

  test('a refresh is broadcast as a session delta', async () => {
    vi.useFakeTimers()
    const { store, tracker, broadcasts } = setup(async () => ({ entries: [reply('hi')], complete: true }))
    store.upsert('s', { updatedAt: STAMP }, () => record('s'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(broadcasts.at(-1)).toMatchObject({
      type: 'session.changed',
      sessionId: 's',
      set: { lastActivity: { kind: 'assistant', text: 'hi' } },
    })
    tracker.dispose()
    store.dispose()
  })
})
