import type { Locale } from '@remote-harness/protocol'
import { AppState } from 'react-native'
import { i18n } from './instance'
import { syncDeviceLanguage } from './language-store'

export type { TFunction } from './create'
export * from './language-store'
export * from './preference'
export { i18n }

// The phone's language can change while the app is in the background; pick it up on return (it only
// matters while the preference follows the phone, which the store decides).
AppState.addEventListener('change', (state) => {
  if (state === 'active') syncDeviceLanguage()
})

/** Active locale, e.g. for `Intl` formatting. */
export function currentLocale(): Locale {
  return i18n.language as Locale
}
