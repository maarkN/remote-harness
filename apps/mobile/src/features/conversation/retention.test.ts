import type { TranscriptEntry } from '@remote-harness/protocol'
import { describe, expect, test } from 'vitest'
import { KEEP_STREAMS, streamsToEvict, touchRecent, trimEntries } from './retention'

const entry = (c: number): TranscriptEntry => ({
  timestamp: null,
  isSidechain: false,
  kind: 'user',
  text: `m${c}`,
  images: [],
  cursor: c,
  index: 0,
  uuid: `u${c}`,
  key: `u${c}:0`,
})

describe('retention', () => {
  test('opening a conversation moves it to the most recent end', () => {
    expect(touchRecent(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a'])
    expect(touchRecent(['a'], 'b')).toEqual(['a', 'b'])
  })

  test(`keeps the ${KEEP_STREAMS} most recent closed conversations`, () => {
    expect(streamsToEvict(['a', 'b', 'c', 'd', 'e'], new Set())).toEqual(['a', 'b'])
    expect(streamsToEvict(['a', 'b', 'c'], new Set())).toEqual([])
  })

  test('never drops an open conversation, however old', () => {
    expect(streamsToEvict(['a', 'b', 'c', 'd', 'e'], new Set(['a']))).toEqual(['b'])
  })

  test('a closed conversation keeps its last entries', () => {
    const entries = Array.from({ length: 520 }, (_, i) => entry(i))
    const { entries: kept, trimmed } = trimEntries(entries)
    expect(trimmed).toBe(true)
    expect(kept).toHaveLength(500)
    expect(kept[0]?.cursor).toBe(20)
    expect(trimEntries(entries.slice(0, 10))).toEqual({ entries: entries.slice(0, 10), trimmed: false })
  })
})
