import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { isVoiceLanguage, type VoiceLanguage } from './language'

const VOICE_LANGUAGE_KEY = 'claude-remote.voice-language'

type VoiceLanguageState = { language: VoiceLanguage }

export const useVoiceLanguageStore = create<VoiceLanguageState>(() => ({ language: 'app' }))

/** Loads the persisted choice; called once at app startup (`app/_layout.tsx`), before any recording can start. */
export async function restoreVoiceLanguage(): Promise<void> {
  const saved = await SecureStore.getItemAsync(VOICE_LANGUAGE_KEY).catch(() => null)
  useVoiceLanguageStore.setState({ language: isVoiceLanguage(saved) ? saved : 'app' })
}

export async function setVoiceLanguage(language: VoiceLanguage): Promise<void> {
  await SecureStore.setItemAsync(VOICE_LANGUAGE_KEY, language)
  useVoiceLanguageStore.setState({ language })
}
