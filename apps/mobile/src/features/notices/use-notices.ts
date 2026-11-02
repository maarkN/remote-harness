import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { useConnectionStore } from '@/core/connection'
import { useMuteStore } from '../mute/store'
import { usePermissionsStore } from '../permissions/store'
import { usePushSettings } from '../push/push-settings-store'
import { useSessionsStore } from '../sessions/store'
import { announces, finishedSessions, isFresh, type NoticeKind, noticeFor, requestKind } from './select'
import { useNoticesStore } from './store'

/** A notice for `kind` in `session`, unless its rules say no (on screen, muted, demo). */
function notify(kind: NoticeKind, sessionId: string): void {
  const session = useSessionsStore.getState().sessions[sessionId]
  if (!session) return
  const context = {
    onScreen: useNoticesStore.getState().onScreen,
    muted: useMuteStore.getState(),
    demo: useConnectionStore.getState().demo,
  }
  if (!announces(session, context)) return
  useNoticesStore.getState().show(noticeFor(kind, session, Date.now()))
  // Requests already give the warning haptic when they arrive (`bindPermissions`); a finished turn
  // gives one here, following the phone's push toggle like the push it stands in for.
  if (kind === 'finished' && usePushSettings.getState().enabled) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
  }
}

/**
 * Turns what the stores already receive into in-app notices (#472): a session's turn ending
 * (`running` → `idle`) and new pending requests (permission, question, plan) of sessions other than
 * the one on screen. Mounted once in the main layout, which knows the session on screen.
 */
export function useNotices(onScreenSessionId: string | null): void {
  useEffect(() => {
    useNoticesStore.setState({ onScreen: onScreenSessionId })
  }, [onScreenSessionId])

  useEffect(() => {
    let sessions = useSessionsStore.getState().sessions
    const offSessions = useSessionsStore.subscribe((state) => {
      const previous = sessions
      sessions = state.sessions
      if (state.sessions === previous) return
      for (const session of finishedSessions(previous, state.sessions)) notify('finished', session.id)
    })
    let known = new Set(Object.keys(usePermissionsStore.getState().pending))
    const offPermissions = usePermissionsStore.subscribe((state) => {
      const now = Date.now()
      for (const [id, request] of Object.entries(state.pending)) {
        if (known.has(id) || !isFresh(request, now)) continue
        notify(requestKind(request), request.sessionId)
      }
      known = new Set(Object.keys(state.pending))
    })
    return () => {
      offSessions()
      offPermissions()
      useNoticesStore.getState().dismiss()
    }
  }, [])
}
