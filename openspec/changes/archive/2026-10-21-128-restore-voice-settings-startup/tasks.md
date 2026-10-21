## 1. Restore at startup

- [x] 1.1 `app/_layout.tsx`: restore the three voice stores alongside the other persisted preferences.
- [x] 1.2 `VoiceLanguageCard.tsx`: drop its own restore calls (now redundant); update the stores' doc comments.

## 2. Outdated-daemon notice

- [x] 2.1 `use-voice-recording.ts`: on `voice.polish` rejected with `unknown_type`, alert that Polish dictation needs a newer daemon, then insert the original transcript.
- [x] 2.2 i18n keys `voice.polishUnsupportedTitle` / `voice.polishUnsupported` in pt-BR, en-US and es-ES.

## 3. Verify

- [x] 3.1 `pnpm check` and `openspec validate --strict`; `npx expo export --platform ios`.
