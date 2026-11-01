## Context

`core/i18n/index.ts` creates the single i18next instance from `deviceLocale(getLocales())` and re-reads the device locale when the app returns to the foreground. Every consumer either renders through `useTranslation()` (re-rendered by react-i18next on `languageChanged`) or reads `i18n.language` / `i18n.t` at call time (widgets, assistant, voice, `Intl` formatting), so a `changeLanguage` already reaches the whole app. The theme preference (`core/theme/store.ts`) is the house pattern for a device-only choice: a Zustand store, `system` as the default, SecureStore persistence, a `restore…()` called once at start. Without credentials, `(main)/_layout.tsx` redirects to the `pair` modal of the root stack.

## Goals / Non-Goals

- Goals: one resolver for the app language (preference × device), restored before the first frame; a first-launch step that existing users never see; a Settings card.
- Non-goals: telling the daemon the app language (push stays in the daemon's language), a per-computer language, RTL.

## Decisions

- **Preference next to the device resolver.** `core/i18n/preference.ts` holds the pure part: `LanguagePreference = 'system' | Locale`, `isLanguagePreference`, `resolveAppLocale(preference, deviceLocale)`. `core/i18n/language-store.ts` holds the Zustand store (`preference`, `restored`, `chosen`), `restoreLanguagePreference()` and `setLanguagePreference()`, which persist in SecureStore (`remote-harness.language`) and call `i18n.changeLanguage` with the resolved locale. `index.ts` keeps creating the instance from the device locale (nothing is read synchronously from SecureStore) and its foreground listener now resolves through the preference, so an explicit language ignores a device-language change.
- **Restore gates the first frame.** The root layout adds `languageRestored` to `ready` (fonts, credentials) so a saved explicit language is never flashed as the device language; the read is one SecureStore item, like the theme's.
- **"Chosen" is "something was saved".** The first-launch step is due when `credentials` is null and no value was ever saved (`chosen === false`). Continue saves the current selection (even `system`), which marks it chosen. Users who update with a paired computer have credentials, so they never see the step; whoever forgets their only computer later sees it once, which is harmless.
- **Own route for the step.** `src/app/language.tsx` in the root stack (header hidden, not a modal, so it is the first full screen), rendering `features/language/LanguageScreen`. `(main)/_layout.tsx` redirects to `/language` instead of `/pair` while the step is due; Continue does `router.replace('/pair')`. Tapping an option on the step applies the preference immediately (live preview, as the theme picker does) without saving; Continue persists. Leaving the step without Continue is impossible (no back button, root of the stack).
- **Settings card with chips.** `features/language/LanguageCard.tsx` follows the Voice card: a title, a hint ("Texts from the computer keep its language") and one chip per option, the selected one filled. Native names come from `LOCALE_NAMES` in the protocol package, so the card never needs translating the language names. Pure `languageOptions(preference, device, t)` builds the rows (label, subtitle for "Same as the phone" naming the resolved language, selected) and is shared by the step and the card.

## Risks / Trade-offs

- [The step applies a language before it is saved; a crash before Continue leaves the device language] → Acceptable: nothing was chosen yet, the step shows again.
- [Header titles are built in layouts with `t()` once per render] → Layouts use `useTranslation`, which re-renders them on `languageChanged`; verified by the existing Settings header in the live-switch scenario.
- [`Intl` formatting cached per locale somewhere] → Consumers read `i18n.language` at call time; no caches keyed by locale exist today.

## Migration Plan

Ships over the air. No stored data changes: the new key is absent on existing devices and reads as "Same as the phone".
