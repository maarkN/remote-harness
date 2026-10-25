import type { TranscriptEntry } from '@remote-harness/protocol'

/** Closed conversations kept in memory, most recently opened first; older ones are fetched again. */
export const KEEP_STREAMS = 3
/** Entries a closed conversation keeps; scrolling up pages older ones back from the daemon. */
export const KEEP_ENTRIES = 500

/** `key` moved to the end of the most-recently-opened list. */
export function touchRecent(recent: readonly string[], key: string): string[] {
  return [...recent.filter((k) => k !== key), key]
}

/**
 * Streams to drop from memory: every one that is not open, beyond the `keep` most recently opened.
 * `recent` lists the keys oldest first.
 */
export function streamsToEvict(
  recent: readonly string[],
  open: ReadonlySet<string>,
  keep = KEEP_STREAMS,
): string[] {
  const kept = new Set(recent.slice(-keep))
  return recent.filter((key) => !kept.has(key) && !open.has(key))
}

/** The last `keep` entries of a closed conversation; `trimmed` when older ones were dropped. */
export function trimEntries(
  entries: readonly TranscriptEntry[],
  keep = KEEP_ENTRIES,
): { entries: TranscriptEntry[]; trimmed: boolean } {
  if (entries.length <= keep) return { entries: entries as TranscriptEntry[], trimmed: false }
  return { entries: entries.slice(-keep), trimmed: true }
}
