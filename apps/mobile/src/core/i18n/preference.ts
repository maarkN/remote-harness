import { LOCALES, type Locale } from '@remote-harness/protocol'

/** What the user picked for the app language: a locale, or `system` to follow the phone. */
export type LanguagePreference = 'system' | Locale

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ['system', ...LOCALES]

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === 'string' && (LANGUAGE_PREFERENCES as readonly string[]).includes(value)
}

/** The locale the app shows: the preference, or the device locale when it follows the phone. */
export function resolveAppLocale(preference: LanguagePreference, device: Locale): Locale {
  return preference === 'system' ? device : preference
}
