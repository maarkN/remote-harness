/**
 * How the history cache follows a transcript without gaps (ADR 0004). A stream's cached entries are
 * always one contiguous run of the transcript's lines: every line from `floor` to `lastCursor` was
 * read, so the app can resume from `lastCursor` and page older entries from the cache down to
 * `floor`. Pure: the database applies the plan.
 */

export type CachedRun = {
  /** Lowest line cursor in the run. */
  floor: number
  /** Highest line cursor received. */
  lastCursor: number
  /** The run reaches the first line: there is nothing older to fetch. */
  complete: boolean
}

type Cursored = { cursor: number }

/** What arrived from the daemon for one stream. */
export type SyncEvent =
  /** The last page, on a subscription without a cursor. */
  | { kind: 'initial'; entries: readonly Cursored[]; hasMore: boolean }
  /** The answer to a subscription from `since`; `hasMore` means it could not cover the gap. */
  | { kind: 'resume'; since: number; entries: readonly Cursored[]; hasMore: boolean }
  /** Entries streamed live; `previous` is the app's cursor before them (null when it had none). */
  | { kind: 'live'; previous: number | null; entries: readonly Cursored[] }
  /** A `session.history` page of the lines before `before`. */
  | { kind: 'older'; before: number; entries: readonly Cursored[]; hasMore: boolean }

/** `extend`: upsert the entries, keep the others. `replace`: drop the stream's entries first. */
export type SyncPlan = { kind: 'extend' | 'replace'; run: CachedRun } | { kind: 'skip' }

function bounds(entries: readonly Cursored[]): { low: number; high: number } | null {
  if (entries.length === 0) return null
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (const { cursor } of entries) {
    if (cursor < low) low = cursor
    if (cursor > high) high = cursor
  }
  return { low, high }
}

/** Entries after `previous`: they extend a run that ends there, otherwise they start a new one. */
function append(run: CachedRun | null, previous: number | null, entries: readonly Cursored[]): SyncPlan {
  const range = bounds(entries)
  if (!range) return { kind: 'skip' }
  if (run && previous !== null && run.lastCursor === previous)
    return { kind: 'extend', run: { ...run, lastCursor: Math.max(run.lastCursor, range.high) } }
  return { kind: 'replace', run: { floor: range.low, lastCursor: range.high, complete: false } }
}

/** The write that keeps `run` contiguous after `event`. */
export function planSync(run: CachedRun | null, event: SyncEvent): SyncPlan {
  switch (event.kind) {
    case 'initial': {
      const range = bounds(event.entries)
      if (!range) return { kind: 'skip' }
      return { kind: 'replace', run: { floor: range.low, lastCursor: range.high, complete: !event.hasMore } }
    }
    case 'resume': {
      if (!event.hasMore) return append(run, event.since, event.entries)
      const range = bounds(event.entries)
      if (!range) return { kind: 'skip' }
      return { kind: 'replace', run: { floor: range.low, lastCursor: range.high, complete: false } }
    }
    case 'live':
      return append(run, event.previous, event.entries)
    case 'older': {
      // Only a page that ends where the run starts keeps it contiguous.
      if (!run || run.floor !== event.before) return { kind: 'skip' }
      const range = bounds(event.entries)
      return {
        kind: 'extend',
        run: { ...run, floor: range ? Math.min(run.floor, range.low) : run.floor, complete: !event.hasMore },
      }
    }
  }
}
