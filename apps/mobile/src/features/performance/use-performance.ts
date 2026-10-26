import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { useLayout } from '@/core/layout'
import { benchAppReady, benchStall } from './bench-store'
import { setPerformanceCollection, startTrace, stopTrace } from './perf'
import { APP_READY_TIMEOUT_MS, addStall, EMPTY_STALLS, STALL_TICK_MS, stallMs } from './stalls'
import { usePerformanceSettings } from './store'

/** When the JavaScript of this run started (this module loads with the root layout). */
const STARTED_AT = Date.now()
let appReadyRecorded = false

/**
 * Records once per run the time to the first daemon connection (or a timeout) in this run's local
 * numbers, and sends it as `app_ready` when collection was on at that moment.
 */
function recordAppReady(outcome: 'connected' | 'timeout', send: boolean): void {
  if (appReadyRecorded) return
  appReadyRecorded = true
  const ms = Date.now() - STARTED_AT
  benchAppReady(ms)
  if (send) stopTrace(startTrace('app_ready', { outcome }), { ready_ms: ms })
}

/**
 * Applies the "Send performance data" choice, keeps this run's local numbers (app ready and the stalls
 * of the JavaScript thread, measured by how late a timer fires) and, while the choice is on, sends
 * `app_ready` and one `js_responsiveness` trace per stretch in the foreground. Traces carry numbers and
 * the layout class only.
 */
export function usePerformanceMonitoring(): void {
  const enabled = usePerformanceSettings((s) => s.enabled)
  const loaded = usePerformanceSettings((s) => s.loaded)
  const status = useConnectionStore((s) => s.status)
  // Nothing of the offline demo is sent, whatever the choice says.
  const demo = useConnectionStore((s) => s.demo)
  const sending = enabled && !demo
  const { layout } = useLayout()

  useEffect(() => {
    if (loaded) setPerformanceCollection(sending)
  }, [loaded, sending])

  useEffect(() => {
    if (!loaded || appReadyRecorded) return
    // Sent only when collection is on at that moment: turning it on later never sends this run's start.
    if (status === 'open') return recordAppReady('connected', sending)
    const timer = setTimeout(
      () =>
        recordAppReady(
          'timeout',
          usePerformanceSettings.getState().enabled && !useConnectionStore.getState().demo,
        ),
      Math.max(0, APP_READY_TIMEOUT_MS - (Date.now() - STARTED_AT)),
    )
    return () => clearTimeout(timer)
  }, [loaded, sending, status])

  // `sending` restarts the stretch so the trace starts or stops with the choice.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `sending` is read by `startTrace`, not here.
  useEffect(() => {
    if (!loaded) return
    let stop: (() => void) | null = null
    const begin = () => {
      // null while collection is off: the stalls still go to the local numbers.
      const trace = startTrace('js_responsiveness', { layout })
      let summary = EMPTY_STALLS
      let last = Date.now()
      const timer = setInterval(() => {
        const now = Date.now()
        const ms = stallMs(last + STALL_TICK_MS, now)
        if (ms > 0) benchStall(ms)
        summary = addStall(summary, ms)
        last = now
      }, STALL_TICK_MS)
      stop = () => {
        clearInterval(timer)
        stopTrace(trace, summary)
        stop = null
      }
    }
    if (AppState.currentState === 'active') begin()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !stop) begin()
      else if (state !== 'active') stop?.()
    })
    return () => {
      subscription.remove()
      stop?.()
    }
  }, [loaded, sending, layout])
}
