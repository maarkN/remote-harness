import type { Locale } from '@remote-harness/protocol'
import { getLocales } from 'expo-localization'
import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import { deviceLocale } from './device'
import { i18n } from './instance'
import { isLanguagePreference, type LanguagePreference, resolveAppLocale } from './preference'

const LANGUAGE_KEY = 'remote-harness.language'

export type LanguageState = {
  /** Saved on the device; `system` (the phone's language) by default. */
  preference: LanguagePreference
  /** Whether the saved preference has been read (saved or not); `preference` is a default until then. */
  restored: boolean
  /** Whether a preference was ever saved: the first-launch language step is due until it is. */
  chosen: boolean
}

export const useLanguageStore = create<LanguageState>(() => ({
  preference: 'system',
  restored: false,
  chosen: false,
}))

/** The locale the current preference resolves to, for the phone's language right now. */
export function currentAppLocale(preference = useLanguageStore.getState().preference): Locale {
  return resolveAppLocale(preference, deviceLocale(getLocales()))
}

function apply(preference: LanguagePreference): void {
  const next = currentAppLocale(preference)
  if (next !== i18n.language) void i18n.changeLanguage(next)
}

/** Loads the persisted choice and applies it; called once at app start, before the first screen. */
export async function restoreLanguagePreference(): Promise<void> {
  const saved = await SecureStore.getItemAsync(LANGUAGE_KEY).catch(() => null)
  if (isLanguagePreference(saved)) {
    useLanguageStore.setState({ preference: saved, restored: true, chosen: true })
    apply(saved)
  } else {
    useLanguageStore.setState({ restored: true })
  }
}

/** Applies a preference without saving it: the first-launch step previews each option this way. */
export function previewLanguage(preference: LanguagePreference): void {
  useLanguageStore.setState({ preference })
  apply(preference)
}

/** Applies and saves a preference; marks the first-launch step as done. */
export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  useLanguageStore.setState({ preference, chosen: true })
  apply(preference)
  await SecureStore.setItemAsync(LANGUAGE_KEY, preference).catch(() => undefined)
}

/** Re-resolves the language after the phone's own language may have changed (app back in the foreground). */
export function syncDeviceLanguage(): void {
  apply(useLanguageStore.getState().preference)
}
