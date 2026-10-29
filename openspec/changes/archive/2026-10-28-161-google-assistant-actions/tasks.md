## 1. Links and screen

- [x] 1.1 `src/features/assistant/links.ts` (`parseAssistantLink`, session by title) and `link-flow.ts` (first step of a link, never sending), with Vitest tests
- [x] 1.2 `AssistantLinkScreen` + route `src/app/(main)/assistant/[action].tsx`: reply / open session, confirm permission, waiting summary; announced for screen readers
- [x] 1.3 i18n keys for the screen in pt-BR, en-US and es-ES

## 2. Android native

- [x] 2.1 Android part of `modules/voice-assistant` (`setSessions` → dynamic shortcuts, `complete` no-op) and the forwarding `AssistantLinkActivity`
- [x] 2.2 `modules/voice-assistant/android-actions.ts` (typed capabilities and query patterns per language) and the config plugin writing `shortcuts.xml`, the arrays and the meta-data on the launcher activities, with tests

## 3. Verification

- [x] 3.1 `turbo run typecheck test` and Biome green
- [x] 3.2 `expo prebuild` + Gradle `assembleDebug` compile the app with the module and resources
- [x] 3.3 Docs: Google Assistant and launcher shortcuts in the app docs (three languages), with the version limits
