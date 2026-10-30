import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { i18n } from '@/core/i18n'
import { useThemeStore } from '@/core/theme'
import { usePermissionsStore } from '../permissions/store'
import { useLimitsStore } from '../session-status/limits-store'
import { useSessionsStore } from '../sessions/store'
import { snapshotKey, type WidgetSnapshot } from './logic'
import { publishWidgets } from './publish'
import { snapshotOf } from './refresh'
import { loadSnapshot } from './store'

/** Changes within this time are drawn together (a busy session is one redraw per interval at most). */
const PUBLISH_INTERVAL_MS = 1_000

/**
 * Keeps the Home Screen and Lock Screen widgets on the active computer while the app runs: a new
 * snapshot when sessions, pending requests, limits, the theme or the language change (only when
 * something visible changed), and at once when the app goes to the background. Without a paired
 * computer they show the "pair" state; the demo never reaches them.
 */
export function useWidgets() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let last: WidgetSnapshot | null = null
    let lastKey = ''
    /** Draws unless nothing visible changed; `always` (leaving the app) also refreshes the time. */
    const draw = (snapshot: WidgetSnapshot, always: boolean) => {
      const key = snapshotKey(snapshot)
      if (!always && key === lastKey) return
      last = snapshot
      lastKey = key
      void publishWidgets(snapshot)
    }
    const publish = (always = false) => {
      if (timer) clearTimeout(timer)
      timer = undefined
      const connection = useConnectionStore.getState()
      if (connection.demo || !connection.credentialsLoaded) return
      if (connection.computers.length === 0) {
        draw(snapshotOf(null, { sessions: [], pending: [], limits: [] }), always)
        return
      }
      const { sessions, loaded } = useSessionsStore.getState()
      // Before the first session list of this computer the widgets keep what they had.
      if (!connection.credentials || !connection.client || !loaded) return
      draw(
        snapshotOf(
          connection.credentials,
          {
            sessions: Object.values(sessions),
            pending: Object.values(usePermissionsStore.getState().pending),
            limits: Object.values(useLimitsStore.getState().byProfile),
            host: connection.hello?.host ?? null,
          },
          { previous: last },
        ),
        always,
      )
    }
    const schedule = () => {
      timer ??= setTimeout(() => publish(), PUBLISH_INTERVAL_MS)
    }
    const offs = [
      useSessionsStore.subscribe(schedule),
      usePermissionsStore.subscribe(schedule),
      useLimitsStore.subscribe(schedule),
      useThemeStore.subscribe(schedule),
      useConnectionStore.subscribe((state, previous) => {
        if (
          state.credentials !== previous.credentials ||
          state.computers !== previous.computers ||
          state.credentialsLoaded !== previous.credentialsLoaded ||
          state.hello !== previous.hello ||
          state.demo !== previous.demo
        )
          schedule()
      }),
    ]
    const onLanguage = () => schedule()
    i18n.on('languageChanged', onLanguage)
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') publish(true)
    })
    // The saved snapshot gives the first one its state times.
    void loadSnapshot().then((saved) => {
      last ??= saved
      schedule()
    })
    return () => {
      if (timer) clearTimeout(timer)
      for (const off of offs) off()
      i18n.off('languageChanged', onLanguage)
      appState.remove()
    }
  }, [])
}
