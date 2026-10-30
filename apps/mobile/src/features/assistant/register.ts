import { runOnShortLivedClient } from '@/core/connection/short-lived'
import { i18n } from '@/core/i18n'
import { VoiceAssistant, type VoiceAssistantRequestEvent } from '../../../modules/voice-assistant'
import { handleAssistantRequest, parseAssistantRequest } from './handler'

/**
 * Loaded by the entry file (`index.ts`) before Expo Router, like the push handlers: a Siri request
 * can arrive while the app is in the background, before (or without) any screen. Each request uses
 * its own short-lived connection to the active computer and answers with a sentence to speak.
 */
async function answer(event: VoiceAssistantRequestEvent): Promise<void> {
  const request = parseAssistantRequest(event.payload)
  const result = request
    ? await runOnShortLivedClient((client) => handleAssistantRequest(request, client, i18n.t))
    : null
  const reply = result?.ok
    ? result.value
    : { ok: false, message: i18n.t(request ? 'assistant.unreachable' : 'assistant.failed') }
  VoiceAssistant?.complete(event.id, reply)
}

VoiceAssistant?.addListener('onRequest', (event) => {
  void answer(event)
})
