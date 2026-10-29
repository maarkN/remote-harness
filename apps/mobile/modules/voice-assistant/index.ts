import { type NativeModule, requireOptionalNativeModule } from 'expo'

/** A request from a voice assistant: `payload` is parsed by `src/features/assistant/handler.ts`. */
export type VoiceAssistantRequestEvent = {
  id: string
  payload: unknown
  /** The intent brought the app to the foreground to finish (the app was not running). */
  foreground: boolean
}

export type VoiceAssistantReply = { ok: boolean; message: string; requestId?: string; sessionId?: string }

type Events = { onRequest: (event: VoiceAssistantRequestEvent) => void }

declare class VoiceAssistantModule extends NativeModule<Events> {
  complete(id: string, reply: VoiceAssistantReply): void
  setSessions(json: string): void
}

/** `null` on Android (until #418) and on binaries built before the module (an over-the-air update). */
export const VoiceAssistant = requireOptionalNativeModule<VoiceAssistantModule>('VoiceAssistant')
