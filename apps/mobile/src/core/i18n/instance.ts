import { getLocales } from 'expo-localization'
import { initReactI18next } from 'react-i18next'
import { createI18n } from './create'
import { deviceLocale } from './device'

/**
 * App-wide instance. It starts in the phone's language (per-app language included); the saved
 * preference (`language-store`) is applied as soon as it is read at start-up and whenever it changes.
 */
export const i18n = createI18n(deviceLocale(getLocales()), [initReactI18next])
