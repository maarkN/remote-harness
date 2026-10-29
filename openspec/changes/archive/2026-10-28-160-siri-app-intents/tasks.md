## 1. JavaScript side

- [x] 1.1 `src/features/assistant/sessions.ts`: pure session list for Siri (filter, order, limit) and default session choice, with Vitest tests
- [x] 1.2 `src/features/assistant/handler.ts`: pure request handler (reply, pending, answer, waiting) over an injected client and `t`, with Vitest tests (unreachable, read-only, ended, no request, only questions)
- [x] 1.3 i18n keys `assistant.*` in pt-BR, en-US and es-ES (spoken sentences), parity test green
- [x] 1.4 `modules/voice-assistant/index.ts` (optional native module) + `src/features/assistant/register.ts`: listener at module scope (imported by `index.ts`), short-lived connection per request, answer back with `complete`
- [x] 1.5 Hook in the app shell writing the session list for Siri when the sessions store or the active computer changes

## 2. Native module and intents

- [x] 2.1 `modules/voice-assistant`: `expo-module.config.json`, podspec, `VoiceAssistantModule.swift` (request queue, `onRequest`, `complete`, `setSessions`, acknowledgements)
- [x] 2.2 `modules/voice-assistant/app-intents/`: bridge, `SessionEntity` + query, Reply / Answer / Waiting intents, `AppShortcutsProvider`
- [x] 2.3 `AppShortcuts.xcstrings` and `Localizable.xcstrings` in en, pt-BR and es, with a Vitest parity test over both catalogs
- [x] 2.4 Config plugin in `app.config.ts` copying the intents into the app target and adding them to the Xcode project (idempotent), with a test

## 3. Verification

- [x] 3.1 `turbo run typecheck test` and Biome green
- [x] 3.2 `expo prebuild` + `xcodebuild` for the simulator compile the app with the intents
- [x] 3.3 Docs: a "Siri and Shortcuts" section in the app docs (three languages)
