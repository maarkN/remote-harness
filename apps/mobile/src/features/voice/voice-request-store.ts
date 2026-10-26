import { create } from 'zustand'

type VoiceRequestState = {
  /** A session whose composer should start recording and send when done ("Reply by voice"). */
  sessionId: string | null
}

/** Asked by the notification's "Reply by voice"; taken by that session's composer once it is on screen. */
export const useVoiceRequestStore = create<VoiceRequestState>(() => ({ sessionId: null }))

export function requestVoiceReply(sessionId: string): void {
  useVoiceRequestStore.setState({ sessionId })
}

/** The composer of `sessionId` takes the request (true once); other sessions leave it. */
export function takeVoiceRequest(sessionId: string): boolean {
  if (useVoiceRequestStore.getState().sessionId !== sessionId) return false
  useVoiceRequestStore.setState({ sessionId: null })
  return true
}
