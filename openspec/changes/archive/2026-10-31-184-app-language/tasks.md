## 1. Language preference

- [x] 1.1 `core/i18n/preference.ts`: `LanguagePreference`, `isLanguagePreference`, `resolveAppLocale`; Vitest for the resolver and the guard
- [x] 1.2 `core/i18n/language-store.ts`: Zustand store (`preference`, `restored`, `chosen`), `restoreLanguagePreference`, `setLanguagePreference`, `previewLanguage`; `index.ts` resolves the foreground re-read through the preference; typecheck passes
- [x] 1.3 Root layout restores the preference at start and waits for it in `ready` (no flash of the device language)

## 2. Screens

- [x] 2.1 Pure `features/language/options.ts` (`languageOptions`) with tests: order, native names, "Same as the phone" subtitle, selected row
- [x] 2.2 `features/language/LanguageScreen.tsx` + `src/app/language.tsx` route in the root stack; `(main)/_layout.tsx` redirects to it while the step is due, Continue saves and replaces with `/pair`
- [x] 2.3 `features/language/LanguageCard.tsx` in Settings after Appearance: options applied at once and persisted

## 3. Texts and docs

- [x] 3.1 i18n keys (`language.*`) in pt-BR, en-US and es-ES; parity tests pass
- [x] 3.2 Web docs `using-the-app.md` (three languages): the Language card in Settings and the first-launch step
- [x] 3.3 `openspec validate 184-app-language --strict` passes

## 4. Verify

- [x] 4.1 `turbo run typecheck test`, Biome (worktree workaround), `expo export --platform ios`
