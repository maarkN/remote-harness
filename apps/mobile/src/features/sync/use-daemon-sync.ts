import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { useConnectionStore, useDaemonClient } from '@/core/connection'
import { useTranscriptStore } from '@/features/conversation/store'
import { bindDaemonUpdate } from '@/features/daemon-update/store'
import { bindErrorReports } from '@/features/error-reports/capture'
import { bindMute } from '@/features/mute/store'
import { bindPermissions, usePermissionsStore } from '@/features/permissions/store'
import { bindQueue } from '@/features/queue/store'
import { bindLimits } from '@/features/session-status/limits-store'
import { bindSessions, useSessionsStore } from '@/features/sessions/store'

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
  const shown = useRef(activeId)
  useEffect(() => {
    if (shown.current !== activeId) clearComputerState()
    shown.current = activeId
  }, [activeId])
  useEffect(() => {
    if (!client) return
    const unbinders = [
      bindSessions(client),
      bindMute(client),
      bindLimits(client),
      bindQueue(client),
      bindDaemonUpdate(client),
      bindErrorReports(client),
      bindPermissions(client, () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    ]
    return () => {
      for (const unbind of unbinders) unbind()
    }
  }, [client])
}
