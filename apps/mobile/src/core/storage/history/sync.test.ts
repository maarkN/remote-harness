import { describe, expect, test } from 'vitest'
import { type CachedRun, planSync } from './sync'

const at = (...cursors: number[]) => cursors.map((cursor) => ({ cursor }))
const run: CachedRun = { floor: 100, lastCursor: 120, complete: false }

describe('planSync', () => {
  test('the last page starts the run; complete when nothing is older', () => {
    expect(planSync(null, { kind: 'initial', entries: at(5, 9), hasMore: false })).toEqual({
      kind: 'replace',
      run: { floor: 5, lastCursor: 9, complete: true },
    })
    expect(planSync(run, { kind: 'initial', entries: [], hasMore: false })).toEqual({ kind: 'skip' })
  })

  test('a resume from the cached cursor extends the run', () => {
    expect(planSync(run, { kind: 'resume', since: 120, entries: at(121, 130), hasMore: false })).toEqual({
      kind: 'extend',
      run: { floor: 100, lastCursor: 130, complete: false },
    })
  })

  test('a resume that could not cover the gap replaces the run', () => {
    expect(planSync(run, { kind: 'resume', since: 120, entries: at(900, 950), hasMore: true })).toEqual({
      kind: 'replace',
      run: { floor: 900, lastCursor: 950, complete: false },
    })
  })

  test('live entries extend only a run that ends at the previous cursor', () => {
    expect(planSync(run, { kind: 'live', previous: 120, entries: at(121) })).toMatchObject({
      kind: 'extend',
      run: { lastCursor: 121 },
    })
    // Already-cached lines (a duplicate delivery) keep the cursor.
    expect(planSync(run, { kind: 'live', previous: 120, entries: at(110) })).toMatchObject({
      kind: 'extend',
      run: { lastCursor: 120 },
    })
    expect(planSync(run, { kind: 'live', previous: 125, entries: at(126) })).toEqual({
      kind: 'replace',
      run: { floor: 126, lastCursor: 126, complete: false },
    })
    expect(planSync(null, { kind: 'live', previous: null, entries: at(0, 1) })).toMatchObject({
      kind: 'replace',
    })
    expect(planSync(run, { kind: 'live', previous: 120, entries: [] })).toEqual({ kind: 'skip' })
  })

  test('an older page extends the run only when it ends at the floor', () => {
    expect(planSync(run, { kind: 'older', before: 100, entries: at(50, 99), hasMore: true })).toEqual({
      kind: 'extend',
      run: { floor: 50, lastCursor: 120, complete: false },
    })
    expect(planSync(run, { kind: 'older', before: 100, entries: [], hasMore: false })).toEqual({
      kind: 'extend',
      run: { floor: 100, lastCursor: 120, complete: true },
    })
    expect(planSync(run, { kind: 'older', before: 90, entries: at(0, 89), hasMore: false })).toEqual({
      kind: 'skip',
    })
    expect(planSync(null, { kind: 'older', before: 90, entries: at(0), hasMore: false })).toEqual({
      kind: 'skip',
    })
  })
})
