import { create } from 'zustand'
import {
  addRender,
  type BenchNumbers,
  EMPTY_SCROLL,
  mergeScroll,
  type RenderSample,
  type ScrollSummary,
} from './bench'
import { addStall, EMPTY_STALLS } from './stalls'

/**
 * This run's performance numbers (Settings → Performance), in memory only: never persisted and never
 * sent by the app, whatever the "Send performance data" choice.
 */
export const useBenchStore = create<BenchNumbers>(() => ({
  appReadyMs: null,
  stalls: EMPTY_STALLS,
  renders: [],
  scroll: EMPTY_SCROLL,
}))

export function benchAppReady(ms: number): void {
  useBenchStore.setState({ appReadyMs: ms })
}

export function benchStall(ms: number): void {
  useBenchStore.setState((s) => ({ stalls: addStall(s.stalls, ms) }))
}

export function benchRender(sample: RenderSample): void {
  useBenchStore.setState((s) => ({ renders: addRender(s.renders, sample) }))
}

export function benchScroll(summary: ScrollSummary): void {
  useBenchStore.setState((s) => ({ scroll: mergeScroll(s.scroll, summary) }))
}
