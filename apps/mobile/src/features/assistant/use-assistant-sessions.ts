import { useEffect } from 'react'
import { VoiceAssistant } from '../../../modules/voice-assistant'
import { useSessionsStore } from '../sessions/store'
import { assistantSessions } from './sessions'

/**
 * Keeps the list of sessions Siri offers (the active computer's live sessions) in the app's local
 * storage, written only when it changes. Emptied when the paired screens unmount (computer forgotten).
 */
export function useAssistantSessions(): void {
  useEffect(() => {
    const native = VoiceAssistant
    if (!native) return
    let last = ''
    const write = (sessions: ReturnType<typeof useSessionsStore.getState>['sessions']) => {
      const json = JSON.stringify(assistantSessions(Object.values(sessions)))
      if (json === last) return
      last = json
      native.setSessions(json)
    }
    write(useSessionsStore.getState().sessions)
    const unsubscribe = useSessionsStore.subscribe((state) => write(state.sessions))
    return () => {
      unsubscribe()
      native.setSessions('[]')
    }
  }, [])
}
