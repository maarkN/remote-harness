import type { Session, TranscriptEntry } from '@remote-harness/protocol'
import { beforeEach, describe, expect, test } from 'vitest'
import { ftsQuery, HistoryDb } from './history-db'
import { nodeDatabase } from './node-sqlite.testing'
import { migrate } from './schema'

const A = 'daemon-a'
const B = 'daemon-b'
const S = 'session-1'

function entry(cursor: number, text = `line ${cursor}`, index = 0): TranscriptEntry {
  return {
    key: `u${cursor}:${index}`,
    cursor,
    index,
    uuid: `u${cursor}`,
    timestamp: null,
    isSidechain: false,
    kind: 'assistant_text',
    text,
  }
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => entry(from + i))
const cursors = (entries: readonly TranscriptEntry[] | undefined) => entries?.map((e) => e.cursor)

let sql: ReturnType<typeof nodeDatabase>
let history: HistoryDb
let clock = 1_000

beforeEach(async () => {
  sql = nodeDatabase()
  await migrate(sql)
  clock = 1_000
  history = new HistoryDb(sql, () => clock++)
})

describe('HistoryDb', () => {
  test('migrating twice is a no-op', async () => {
    await migrate(sql)
    expect(await history.latest(A, S)).toBeNull()
  })

  test('caches the last page and resumes forward without duplicates or gaps', async () => {
    await history.apply(A, S, { kind: 'initial', entries: range(100, 120), hasMore: true })
    await history.apply(A, S, { kind: 'resume', since: 120, entries: range(118, 140), hasMore: false })
    await history.apply(A, S, { kind: 'live', previous: 140, entries: range(141, 142) })
    const cached = await history.latest(A, S)
    expect(cursors(cached?.entries)).toEqual(range(100, 142).map((e) => e.cursor))
    expect(cached).toMatchObject({ lastCursor: 142, hasMore: true })
  })

  test('a resume that could not cover the gap replaces the cached copy', async () => {
    await history.apply(A, S, { kind: 'initial', entries: range(0, 10), hasMore: false })
    await history.apply(A, S, { kind: 'resume', since: 10, entries: range(500, 520), hasMore: true })
    const cached = await history.latest(A, S)
    expect(cursors(cached?.entries)).toEqual(range(500, 520).map((e) => e.cursor))
    expect(cached?.hasMore).toBe(true)
  })

  test('live entries that do not follow the cached cursor restart the run', async () => {
    await history.apply(A, S, { kind: 'initial', entries: range(0, 10), hasMore: false })
    await history.apply(A, S, { kind: 'live', previous: 30, entries: range(31, 32) })
    expect(cursors((await history.latest(A, S))?.entries)).toEqual([31, 32])
  })

  test('pages older entries from the cache, then extends it with the daemon’s', async () => {
    await history.apply(A, S, { kind: 'initial', entries: range(300, 600), hasMore: true })
    const latest = await history.latest(A, S, 200)
    expect(latest?.entries[0]?.cursor).toBe(401)
    const older = await history.older(A, S, 401, 50)
    expect(cursors(older?.entries)).toEqual(range(351, 400).map((e) => e.cursor))
    expect(older?.hasMore).toBe(true)
    // Below the cached floor the daemon answers; its page extends the run when it ends at the floor.
    expect(await history.older(A, S, 300, 50)).toBeNull()
    await history.apply(A, S, { kind: 'older', before: 300, entries: range(0, 299), hasMore: false })
    const bottom = await history.older(A, S, 100, 500)
    expect(bottom?.entries[0]?.cursor).toBe(0)
    expect(bottom?.hasMore).toBe(false)
    // A page that does not end at the floor would leave a gap: ignored.
    await history.apply(B, S, { kind: 'initial', entries: range(50, 60), hasMore: true })
    await history.apply(B, S, { kind: 'older', before: 40, entries: range(0, 39), hasMore: false })
    expect(await history.older(B, S, 50, 10)).toBeNull()
  })

  test('a line with several entries is never split across pages', async () => {
    const entries = [entry(1), entry(2, 'a', 0), entry(2, 'b', 1), entry(3)]
    await history.apply(A, S, { kind: 'initial', entries, hasMore: false })
    expect((await history.latest(A, S, 2))?.entries.map((e) => e.key)).toEqual(['u2:0', 'u2:1', 'u3:0'])
  })

  test('images and the session list are kept per computer', async () => {
    await history.apply(A, S, { kind: 'initial', entries: range(0, 1), hasMore: false })
    await history.saveImage(A, S, '1:0', 'image/png', 'AAAA')
    await history.saveImage(A, 'not-cached', '1:0', 'image/png', 'AAAA')
    expect(await history.image(A, S, '1:0')).toEqual({ mediaType: 'image/png', data: 'AAAA' })
    expect(await history.image(A, 'not-cached', '1:0')).toBeNull()
    const session = { id: S, title: 'Fix the pool' } as unknown as Session
    await history.saveSnapshot(
      A,
      [session, { broken: true } as unknown as Session],
      '2026-10-31T10:00:00.000Z',
    )
    const snapshot = await history.snapshot(A)
    expect(snapshot?.fetchedAt).toBe('2026-10-31T10:00:00.000Z')
    // Rows that no longer parse as sessions are left out.
    expect(snapshot?.sessions).toEqual([])
    expect(await history.snapshot(B)).toBeNull()
  })

  test('full-text search finds an entry’s text and follows updates and deletes', async () => {
    await history.apply(A, S, {
      kind: 'initial',
      entries: [entry(0, 'The connection pool allows 5'), entry(1, 'Done')],
      hasMore: false,
    })
    await history.apply(B, S, { kind: 'initial', entries: [entry(0, 'pool elsewhere')], hasMore: false })
    expect(await history.search(A, 'pool')).toEqual([{ stream: S, key: 'u0:0' }])
    await history.apply(A, S, { kind: 'live', previous: 1, entries: [entry(0, 'The limiter')] })
    expect(await history.search(A, 'pool')).toEqual([])
    expect(await history.search(A, 'limiter')).toHaveLength(1)
    expect(await history.search(A, '"unbalanced')).toEqual([])
  })

  test('evicts the least recently opened streams that are not on screen', async () => {
    const big = 'x'.repeat(1_000)
    for (const stream of ['old', 'open', 'new'])
      await history.apply(A, stream, { kind: 'initial', entries: [entry(0, big)], hasMore: false })
    const total = await history.totalBytes()
    expect(total).toBeGreaterThan(3_000)
    const evicted = await history.evict((_computer, stream) => stream === 'open', total - 1)
    expect(evicted).toBe(1)
    expect(await history.latest(A, 'old')).toBeNull()
    expect(await history.latest(A, 'open')).not.toBeNull()
    expect(await history.evict(() => false, Number.MAX_SAFE_INTEGER)).toBe(0)
  })

  test('wiping a computer leaves nothing of it and keeps the others', async () => {
    await history.apply(A, S, { kind: 'initial', entries: [entry(0, 'secret pool')], hasMore: false })
    await history.saveImage(A, S, '0:0', 'image/png', 'AAAA')
    await history.saveSnapshot(A, [], '2026-10-31T10:00:00.000Z')
    await history.apply(B, S, { kind: 'initial', entries: [entry(0, 'other')], hasMore: false })
    await history.wipe(A)
    for (const table of ['entries', 'images', 'streams', 'snapshots']) {
      const row = sql.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE computer = ?`).get(A) as {
        n: number
      }
      expect(row.n).toBe(0)
    }
    expect(await history.search(A, 'secret')).toEqual([])
    expect(await history.latest(B, S)).not.toBeNull()
  })
})

test('ftsQuery quotes every word', () => {
  expect(ftsQuery(' pool  "size" ')).toBe('"pool" """size"""')
  expect(ftsQuery('   ')).toBe('')
})
