/** Runs `run` later; returns a function that cancels it. */
export type Schedule = (run: () => void) => () => void

/** Before the next frame is drawn (a timer where there is no frame callback, e.g. tests). */
export const nextFrame: Schedule = (run) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(() => run())
    return () => cancelAnimationFrame(id)
  }
  const timer = setTimeout(run, 16)
  return () => clearTimeout(timer)
}

/**
 * Collects items pushed in a burst and hands them to `flush` together, once per `schedule` tick:
 * the transcript entries of a tool-heavy turn become one store update per frame instead of one each.
 */
export function createBatcher<T>(flush: (items: T[]) => void, schedule: Schedule = nextFrame) {
  let pending: T[] = []
  let cancel: (() => void) | null = null
  const run = () => {
    cancel = null
    const items = pending
    pending = []
    if (items.length > 0) flush(items)
  }
  return {
    push(item: T) {
      pending.push(item)
      if (!cancel) cancel = schedule(run)
    },
    /** Hands over what is pending right away (before unsubscribing). */
    flushNow() {
      cancel?.()
      run()
    },
  }
}
