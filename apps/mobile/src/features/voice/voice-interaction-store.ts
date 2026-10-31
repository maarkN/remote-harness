import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { readMigratedKey } from '../../core/storage/migrate-key'

const PUSH_TO_TALK_KEY = 'remote-harness.voice-push-to-talk'
const LEGACY_PUSH_TO_TALK_KEY = 'claude-remote.voice-push-to-talk'

type VoiceInteractionState = { pushToTalk: boolean }

/** "Press and hold to record": off by default (tap to start, tap again to stop). */
export const useVoiceInteractionStore = create<VoiceInteractionState>(() => ({ pushToTalk: false }))

/** Loads the persisted choice; called once at app startup (`app/_layout.tsx`), before any recording can start. */
export async function restoreVoiceInteraction(): Promise<void> {
  const saved = await readMigratedKey(PUSH_TO_TALK_KEY, LEGACY_PUSH_TO_TALK_KEY)
  useVoiceInteractionStore.setState({ pushToTalk: saved === 'true' })
}

export async function setPushToTalk(pushToTalk: boolean): Promise<void> {
  await SecureStore.setItemAsync(PUSH_TO_TALK_KEY, String(pushToTalk))
  useVoiceInteractionStore.setState({ pushToTalk })
}
