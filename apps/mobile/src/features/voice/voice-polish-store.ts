import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { readMigratedKey } from '../../core/storage/migrate-key'

const VOICE_POLISH_KEY = 'remote-harness.voice-polish'
const LEGACY_VOICE_POLISH_KEY = 'claude-remote.voice-polish'

type VoicePolishState = { enabled: boolean }

/** "Polish dictation": off by default, Claude Code sessions only (see `use-voice-recording.ts`). */
export const useVoicePolishStore = create<VoicePolishState>(() => ({ enabled: false }))

/** Loads the persisted choice; called once at app startup (`app/_layout.tsx`), before any recording can start. */
export async function restoreVoicePolish(): Promise<void> {
  const saved = await readMigratedKey(VOICE_POLISH_KEY, LEGACY_VOICE_POLISH_KEY)
  useVoicePolishStore.setState({ enabled: saved === 'true' })
}

export async function setVoicePolish(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(VOICE_POLISH_KEY, String(enabled))
  useVoicePolishStore.setState({ enabled })
}
