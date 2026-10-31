import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { useConnectionStore, useDaemonClient } from '@/core/connection'
import { setTranscriptHistory, useTranscriptStore } from '@/features/conversation/store'
import { bindDaemonUpdate } from '@/features/daemon-update/store'
import { bindErrorReports } from '@/features/error-reports/capture'
import { activeHistory } from '@/features/history/active'
import { bindSessionSnapshot } from '@/features/history/session-snapshot'
import { bindMute } from '@/features/mute/store'
import { bindPermissions, usePermissionsStore } from '@/features/permissions/store'
import { bindQueue } from '@/features/queue/store'
import { bindLimits } from '@/features/session-status/limits-store'
import { bindSessions, useSessionsStore } from '@/features/sessions/store'

// Conversations read and write the active computer's history cache (ADR 0004).
setTranscriptHistory(activeHistory)

/** What one computer showed: cleared when another computer becomes active. */
function clearComputerState(): void {
  useSessionsStore.setState({ sessions: {}, loaded: false, lastFetchedAt: null })
  usePermissionsStore.setState({ pending: {}, lastResolved: null })
  useTranscriptStore.setState({ streams: {}, recent: [], open: {} })
}

/** Binds every feature store to the current daemon client (re-binds when the computer changes). */
export function useDaemonSync() {
  const client = useDaemonClient()
  const activeId = useConnectionStore((s) => s.activeId)
  const demo = useConnectionStore((s) => s.demo)
  const shown = useRef(activeId)
  useEffect(() => {
    if (shown.current !== activeId) clearComputerState()
    shown.current = activeId
  }, [activeId])
  // The last session list of the active computer, cached for an unreachable start (never the demo's).
  useEffect(() => {
    if (!activeId || demo) return
    return bindSessionSnapshot(activeId)
  }, [activeId, demo])
  useEffect(() => {
    if (!client) return
    const unbinders = [
      bindSessions(client),
      bindMute(client),
      bindLimits(client),
      bindQueue(client),
      bindDaemonUpdate(client),
      // The offline demo's refusals are not the app's errors.
      ...(demo ? [] : [bindErrorReports(client)]),
      bindPermissions(client, () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    ]
    return () => {
      for (const unbind of unbinders) unbind()
    }
  }, [client, demo])
}
