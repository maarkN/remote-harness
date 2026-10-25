import type { TranscriptEntry } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { createI18n } from '@/core/i18n/create'
import { createBatcher } from './batch'
import { cachedDiffForTool } from './diff'
import { buildTimeline, EMPTY_TIMELINE, extendTimeline, mergeEntries, type Timeline } from './timeline'

const base = { timestamp: null, isSidechain: false }
const user = (c: number, text = 'hi', index = 0): TranscriptEntry => ({
  ...base,
  kind: 'user',
  text,
  images: [],
  cursor: c,
  index,
  uuid: `u${c}`,
  key: `u${c}:${index}`,
})
const use = (c: number, id: string): TranscriptEntry => ({
  ...base,
  kind: 'tool_use',
  toolUseId: id,
  name: 'Edit',
  input: { file_path: '/w/a.ts', old_string: 'a\nb', new_string: 'a\nc' },
  cursor: c,
  index: 0,
  uuid: `t${c}`,
  key: `t${c}:0`,
})
const result = (c: number, id: string): TranscriptEntry => ({
  ...base,
  kind: 'tool_result',
  toolUseId: id,
  content: 'ok',
  isError: false,
  truncated: false,
  images: [],
  cursor: c,
  index: 0,
  uuid: `r${c}`,
  key: `r${c}:0`,
})

/** Feeds `batches` the way the store does and checks every step against a full rebuild. */
function feed(batches: TranscriptEntry[][]): Timeline {
  let entries: TranscriptEntry[] = []
  let timeline = EMPTY_TIMELINE
  for (const batch of batches) {
    entries = mergeEntries(entries, batch)
    timeline = extendTimeline(timeline, entries)
    expect(timeline.items).toEqual(buildTimeline(entries))
  }
  return timeline
}

describe('mergeEntries append path', () => {
  test('entries after the last one are appended, keeping the existing objects', () => {
    const existing = [user(0), user(1)]
    const merged = mergeEntries(existing, [user(2), user(2, 'x', 1), user(3)])
    expect(merged.map((e) => e.key)).toEqual(['u0:0', 'u1:0', 'u2:0', 'u2:1', 'u3:0'])
    expect(merged[0]).toBe(existing[0])
  })

  test('out of order or repeated entries still sort and de-duplicate', () => {
    expect(mergeEntries([user(2)], [user(1), user(2), user(3)]).map((e) => e.cursor)).toEqual([1, 2, 3])
    expect(mergeEntries([user(1)], [user(3), user(2)]).map((e) => e.cursor)).toEqual([1, 2, 3])
  })
})

describe('extendTimeline', () => {
  test('matches a full build through a live turn', () => {
    feed([[user(0)], [use(1, 'a')], [result(2, 'a'), use(3, 'b')], [result(4, 'b'), user(5)]])
  })

  test('appending keeps the other items as the same objects', () => {
    let entries = [user(0), use(1, 'a')]
    const first = extendTimeline(EMPTY_TIMELINE, entries)
    entries = mergeEntries(entries, [result(2, 'a'), user(3)])
    const next = extendTimeline(first, entries)
    expect(next.items[0]).toBe(first.items[0])
    expect(next.items[1]).not.toBe(first.items[1])
    expect(next.items[1]).toMatchObject({ type: 'tool', result: { toolUseId: 'a' } })
  })

  test('an older page or an orphan result moving to its call rebuilds, still equal', () => {
    feed([
      [user(5), result(6, 'x')],
      [user(1), use(2, 'x')],
    ])
    feed([[user(0), result(1, 'late')], [use(2, 'late')]])
  })

  test('the same entries return the same timeline', () => {
    const entries = [user(0)]
    const timeline = extendTimeline(EMPTY_TIMELINE, entries)
    expect(extendTimeline(timeline, entries)).toBe(timeline)
  })
})

describe('createBatcher', () => {
  test('a burst is flushed once, on the next tick', () => {
    const flushed: number[][] = []
    let tick = null as (() => void) | null
    const batch = createBatcher<number>(
      (items) => flushed.push(items),
      (run) => {
        tick = run
        return () => {
          tick = null
        }
      },
    )
    batch.push(1)
    batch.push(2)
    batch.push(3)
    expect(flushed).toEqual([])
    tick?.()
    expect(flushed).toEqual([[1, 2, 3]])
    batch.push(4)
    batch.flushNow()
    expect(flushed).toEqual([[1, 2, 3], [4]])
    expect(tick).toBeNull()
  })
})

describe('cachedDiffForTool', () => {
  const en = createI18n('en-US').t
  const pt = createI18n('pt-BR').t

  test('diffs a call once per language', () => {
    const call = { name: 'Edit', input: { old_string: 'a\nb', new_string: 'a\nc' } }
    const first = cachedDiffForTool(call, en)
    expect(first?.map((l) => l.kind)).toEqual(['context', 'remove', 'add'])
    expect(cachedDiffForTool(call, en)).toBe(first)
    expect(cachedDiffForTool(call, pt)).not.toBe(first)
  })
})
