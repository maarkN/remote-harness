import type { StallSummary } from './stalls'

/** One display frame at 60 Hz. */
export const FRAME_MS = 1000 / 60
/** A frame longer than this many display frames dropped the ones it skipped. */
const DROP_FACTOR = 1.5
/** Conversation renders kept in this run's numbers (the most recent last). */
export const RENDER_SAMPLES = 5

/** Frames seen while the user scrolled a conversation: sent as `conversation_scroll`'s metrics. */
export type ScrollSummary = { frames: number; dropped: number; frame_max_ms: number }

export const EMPTY_SCROLL: ScrollSummary = { frames: 0, dropped: 0, frame_max_ms: 0 }

/** Opening a conversation until its list drew its items. */
export type RenderSample = { ms: number; entries: number }

/** Display frames a frame of `deltaMs` skipped (0 when it was on time). */
export function droppedFrames(deltaMs: number): number {
  if (deltaMs <= FRAME_MS * DROP_FACTOR) return 0
  return Math.max(0, Math.round(deltaMs / FRAME_MS) - 1)
}

export function addFrame(summary: ScrollSummary, deltaMs: number): ScrollSummary {
  return {
    frames: summary.frames + 1,
    dropped: summary.dropped + droppedFrames(deltaMs),
    frame_max_ms: Math.max(summary.frame_max_ms, Math.round(deltaMs)),
  }
}

export function mergeScroll(a: ScrollSummary, b: ScrollSummary): ScrollSummary {
  return {
    frames: a.frames + b.frames,
    dropped: a.dropped + b.dropped,
    frame_max_ms: Math.max(a.frame_max_ms, b.frame_max_ms),
  }
}

export function addRender(samples: readonly RenderSample[], sample: RenderSample): RenderSample[] {
  return [...samples, sample].slice(-RENDER_SAMPLES)
}

/** This run's numbers, kept in memory on the device only. */
export type BenchNumbers = {
  appReadyMs: number | null
  stalls: StallSummary
  renders: RenderSample[]
  scroll: ScrollSummary
}

export type BenchMeta = { version: string; platform: string; layout: string }

/** Header of the before/after table the performance PRs paste (CONTRIBUTING.md). */
export const BENCH_HEADER = [
  '| Build | Device | Layout | App ready (ms) | JS stalls (count / ≥5 s / max ms) | Conversation render (ms · entries) | Scroll (frames / dropped / max ms) |',
  '|---|---|---|---|---|---|---|',
].join('\n')

/** This run as one row of the before/after table; "—" where nothing was measured. */
export function benchRow(numbers: BenchNumbers, meta: BenchMeta): string {
  const { stalls, scroll } = numbers
  const renders = numbers.renders.map((r) => `${r.ms} · ${r.entries}`).join(', ') || '—'
  const cells = [
    meta.version,
    meta.platform,
    meta.layout,
    numbers.appReadyMs === null ? '—' : String(numbers.appReadyMs),
    `${stalls.stalls} / ${stalls.long_stalls} / ${stalls.stall_max_ms}`,
    renders,
    scroll.frames === 0 ? '—' : `${scroll.frames} / ${scroll.dropped} / ${scroll.frame_max_ms}`,
  ]
  return `| ${cells.join(' | ')} |`
}
