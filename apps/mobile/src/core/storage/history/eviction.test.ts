import { expect, test } from 'vitest'
import { planEviction, type StreamUsage } from './eviction'

const usage = (stream: string, bytes: number, usedAt: number): StreamUsage => ({
  computer: 'a',
  stream,
  bytes,
  usedAt,
})

test('nothing to evict within the cap', () => {
  expect(planEviction([usage('s', 50, 1)], 50, () => false, 100)).toEqual([])
})

test('least recently opened first, skipping open streams, down to the target', () => {
  const streams = [usage('new', 40, 30), usage('open', 40, 10), usage('old', 40, 20), usage('older', 40, 5)]
  const chosen = planEviction(streams, 160, (s) => s.stream === 'open', 100)
  // 160 → 120 (older) → 80 (old) ≤ 90: stops; the open one is never chosen.
  expect(chosen.map((s) => s.stream)).toEqual(['older', 'old'])
})

test('only open streams left: keeps them even over the cap', () => {
  expect(planEviction([usage('open', 500, 1)], 500, () => true, 100)).toEqual([])
})
