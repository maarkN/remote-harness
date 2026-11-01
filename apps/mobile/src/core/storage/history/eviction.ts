/** The history cache's total size cap: entries and images of every computer. */
export const HISTORY_CAP_BYTES = 200 * 1024 * 1024
/** Eviction stops once the cache is under this share of the cap, so it does not run on every write. */
export const EVICTION_TARGET = 0.9

export type StreamUsage = { computer: string; stream: string; bytes: number; usedAt: number }

/**
 * Streams to delete, least recently opened first, until `total` is under `target` bytes; streams on
 * screen (`isOpen`) are never chosen. Empty when `total` is within `cap`.
 */
export function planEviction(
  streams: readonly StreamUsage[],
  total: number,
  isOpen: (usage: StreamUsage) => boolean,
  cap: number = HISTORY_CAP_BYTES,
  target: number = cap * EVICTION_TARGET,
): StreamUsage[] {
  if (total <= cap) return []
  const chosen: StreamUsage[] = []
  let left = total
  for (const usage of [...streams].sort((a, b) => a.usedAt - b.usedAt)) {
    if (left <= target) break
    if (isOpen(usage)) continue
    chosen.push(usage)
    left -= usage.bytes
  }
  return chosen
}
