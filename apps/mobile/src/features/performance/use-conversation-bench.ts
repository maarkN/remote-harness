import { useEffect, useRef } from 'react'
import { useLayout } from '@/core/layout'
import { addFrame, EMPTY_SCROLL, type ScrollSummary } from './bench'
import { benchRender, benchScroll } from './bench-store'
import { startTrace, stopTrace } from './perf'

/** Frames stop being counted this long after the last scroll event. */
const SCROLL_IDLE_MS = 200

/**
 * Measures a conversation for this run's numbers (and the `conversation_ready` /
 * `conversation_scroll` traces when collection is on): the time from opening it (`streamKey`) to its
 * list drawing entries, and the frames seen while the user scrolls it. Wire `onDrawn` to the list's
 * `onLoad` and `onContentSizeChange`, and `onScroll` to its scroll events.
 */
export function useConversationBench(streamKey: string, entries: number) {
  const { layout } = useLayout()
  const openedAt = useRef(Date.now())
  const drawn = useRef(false)
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const scroll = useRef<{
    raf: number | null
    last: number | null
    lastEvent: number
    summary: ScrollSummary
  }>({
    raf: null,
    last: null,
    lastEvent: 0,
    summary: EMPTY_SCROLL,
  })
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // biome-ignore lint/correctness/useExhaustiveDependencies: restarts the measurement for each conversation shown.
  useEffect(() => {
    openedAt.current = Date.now()
    drawn.current = false
    const state = scroll.current
    return () => {
      if (state.raf !== null) cancelAnimationFrame(state.raf)
      state.raf = null
      state.last = null
      if (state.summary.frames > 0) {
        benchScroll(state.summary)
        stopTrace(startTrace('conversation_scroll', { layout: layoutRef.current }), state.summary)
      }
      state.summary = EMPTY_SCROLL
    }
  }, [streamKey])

  const onDrawn = () => {
    if (drawn.current || entriesRef.current === 0) return
    drawn.current = true
    const ms = Date.now() - openedAt.current
    benchRender({ ms, entries: entriesRef.current })
    stopTrace(startTrace('conversation_ready', { layout: layoutRef.current }), {
      render_ms: ms,
      entries: entriesRef.current,
    })
  }

  const onScroll = () => {
    const state = scroll.current
    state.lastEvent = Date.now()
    if (state.raf !== null) return
    const tick = (time: number) => {
      if (state.last !== null) state.summary = addFrame(state.summary, time - state.last)
      state.last = time
      if (Date.now() - state.lastEvent > SCROLL_IDLE_MS) {
        state.raf = null
        state.last = null
        return
      }
      state.raf = requestAnimationFrame(tick)
    }
    state.raf = requestAnimationFrame(tick)
  }

  return { onDrawn, onScroll }
}
