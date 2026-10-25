import { describe, expect, test } from 'vitest'
import {
  addFrame,
  addRender,
  BENCH_HEADER,
  benchRow,
  droppedFrames,
  EMPTY_SCROLL,
  FRAME_MS,
  mergeScroll,
  RENDER_SAMPLES,
} from './bench'
import { EMPTY_STALLS } from './stalls'

describe('scroll frames', () => {
  test('an on-time or slightly late frame drops nothing', () => {
    expect(droppedFrames(FRAME_MS)).toBe(0)
    expect(droppedFrames(FRAME_MS * 1.4)).toBe(0)
  })

  test('a long frame counts the frames it skipped', () => {
    expect(droppedFrames(50)).toBe(2)
    expect(droppedFrames(FRAME_MS * 4)).toBe(3)
  })

  test('one second at 60 Hz with two 50 ms frames drops 4', () => {
    let summary = EMPTY_SCROLL
    for (let i = 0; i < 54; i++) summary = addFrame(summary, FRAME_MS)
    summary = addFrame(summary, 50)
    summary = addFrame(summary, 50)
    expect(summary).toEqual({ frames: 56, dropped: 4, frame_max_ms: 50 })
  })

  test('visits add up, keeping the longest frame', () => {
    expect(
      mergeScroll({ frames: 10, dropped: 1, frame_max_ms: 40 }, { frames: 5, dropped: 2, frame_max_ms: 30 }),
    ).toEqual({ frames: 15, dropped: 3, frame_max_ms: 40 })
  })
})

describe('renders', () => {
  test(`keeps the last ${RENDER_SAMPLES}`, () => {
    let samples = addRender([], { ms: 1, entries: 1 })
    for (let i = 2; i <= 7; i++) samples = addRender(samples, { ms: i, entries: i })
    expect(samples.map((s) => s.ms)).toEqual([3, 4, 5, 6, 7])
  })
})

describe('table row', () => {
  const meta = { version: '0.20.0', platform: 'ios 18.1', layout: 'regular' }

  test('nothing measured yet', () => {
    const row = benchRow({ appReadyMs: null, stalls: EMPTY_STALLS, renders: [], scroll: EMPTY_SCROLL }, meta)
    expect(row).toBe('| 0.20.0 | ios 18.1 | regular | — | 0 / 0 / 0 | — | — |')
  })

  test('a measured run has as many cells as the header', () => {
    const row = benchRow(
      {
        appReadyMs: 1840,
        stalls: { stalls: 2, long_stalls: 1, stall_max_ms: 6100, stall_total_ms: 7300 },
        renders: [
          { ms: 900, entries: 50 },
          { ms: 120, entries: 12 },
        ],
        scroll: { frames: 600, dropped: 42, frame_max_ms: 180 },
      },
      meta,
    )
    expect(row).toBe(
      '| 0.20.0 | ios 18.1 | regular | 1840 | 2 / 1 / 6100 | 900 · 50, 120 · 12 | 600 / 42 / 180 |',
    )
    const columns = (line: string) => line.split('|').length
    expect(columns(row)).toBe(columns(BENCH_HEADER.split('\n')[0]!))
  })
})
