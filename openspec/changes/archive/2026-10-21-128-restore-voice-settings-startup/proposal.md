## Why

Issue #325: after updating the app (daemon not yet updated), a voice recording made before ever opening Settings used the wrong transcription language and skipped Polish dictation — both came back once Settings was opened and its toggle flipped. The three voice stores (`voice-language-store`, `voice-polish-store`, `voice-interaction-store`) were only restored from `SecureStore` by `VoiceLanguageCard.tsx` (Settings), so `use-voice-recording.ts` read their in-memory defaults (`language: 'app'`, `polish: false`, `pushToTalk: false`) for any recording started first. Separately, an older daemon that does not know the `voice.polish` message type (`unknown_type`) made the app silently insert the raw transcript, indistinguishable from Polish dictation doing nothing.

## What Changes

- The three voice stores are restored once at app startup (`app/_layout.tsx`), the same way every other persisted preference already is, instead of from `VoiceLanguageCard` when Settings happens to mount.
- `use-voice-recording.ts`: when the daemon rejects `voice.polish` as an unknown message type, the app tells the user Polish dictation needs a newer daemon before falling back to the original transcript, instead of failing silently. Other polish failures (timeout, a genuine rewrite error) keep inserting the original transcript with no extra step, as today.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `voice-input`: voice settings are applied from the first recording after launch; Polish dictation tells the user when the daemon is too old for it.

## Impact

`apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/features/voice/{voice-language-store,voice-polish-store,voice-interaction-store,use-voice-recording}.ts`, `apps/mobile/src/features/voice/components/VoiceLanguageCard.tsx`, i18n (pt-BR, en-US, es-ES). No protocol or daemon change.
