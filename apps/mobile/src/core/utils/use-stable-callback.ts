import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A function whose identity never changes and that always calls the latest `fn`: for callbacks
 * handed to memoized children (list rows) that would otherwise re-render them on every render.
 * Not for calling during render.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
