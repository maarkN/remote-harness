import { LOCALE_NAMES, type Locale } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '@/core/i18n/preference'

/** One option of the language step and of Settings → Language, in display order (the phone's first). */
export type LanguageOption = {
  choice: LanguagePreference
  /** "Same as the phone", or the language's native name. */
  label: string
  /** For "Same as the phone": which language it resolves to right now; `null` otherwise. */
  hint: string | null
  selected: boolean
}

/** Rows for the pickers; `device` is the locale the phone's language resolves to. */
export function languageOptions(
  preference: LanguagePreference,
  device: Locale,
  t: TFunction,
): LanguageOption[] {
  return LANGUAGE_PREFERENCES.map((choice) => ({
    choice,
    label: choice === 'system' ? t('language.system') : LOCALE_NAMES[choice],
    hint: choice === 'system' ? t('language.systemHint', { language: LOCALE_NAMES[device] }) : null,
    selected: choice === preference,
  }))
}
