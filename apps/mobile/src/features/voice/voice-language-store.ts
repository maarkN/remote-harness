import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { readMigratedKey } from '../../core/storage/migrate-key'
import { isVoiceLanguage, type VoiceLanguage } from './language'

const VOICE_LANGUAGE_KEY = 'remote-harness.voice-language'
const LEGACY_VOICE_LANGUAGE_KEY = 'claude-remote.voice-language'

type VoiceLanguageState = { language: VoiceLanguage }

export const useVoiceLanguageStore = create<VoiceLanguageState>(() => ({ language: 'app' }))

/** Loads the persisted choice; called once at app startup (`app/_layout.tsx`), before any recording can start. */
export async function restoreVoiceLanguage(): Promise<void> {
  const saved = await readMigratedKey(VOICE_LANGUAGE_KEY, LEGACY_VOICE_LANGUAGE_KEY)
  useVoiceLanguageStore.setState({ language: isVoiceLanguage(saved) ? saved : 'app' })
}

export async function setVoiceLanguage(language: VoiceLanguage): Promise<void> {
  await SecureStore.setItemAsync(VOICE_LANGUAGE_KEY, language)
  useVoiceLanguageStore.setState({ language })
}
