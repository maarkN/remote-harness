## Why

The only voice entry points today are dictation in the reply field and the "Reply by voice" notification action, which opens the app recording (#371). Nobody can say "Hey Siri, reply in Remote Harness …" or ask Siri what is waiting, which matters most when the hands are busy (#417, part of the hands-free work in #416).

## What Changes

- iOS App Intents (iOS 16+) exposed to Siri, the Shortcuts app and Spotlight, with App Shortcuts phrases in pt-BR, en-US and es-ES:
  - **Reply to a session** (session + text; defaults to the session that needs me, else the most recent one).
  - **Answer the pending permission** (allow / deny the oldest plain permission request, read aloud and confirmed first).
  - **What's waiting** (how many sessions wait for me and their titles).
- The intents run without opening the app when the app's JavaScript is alive; otherwise (app closed) they ask to continue in the app (iOS 17+) and finish there. Each needs the device unlocked.
- A local Expo module (`modules/voice-assistant`) bridges the intents to the app's JavaScript, which reaches the computer with the existing short-lived connection (same path as notification actions) and answers with a sentence in the app language.
- The app keeps an on-device list of the active computer's sessions (id, title, state) for Siri's session parameter.
- A config plugin adds the intent sources and their string catalogs to the app target on prebuild.

## Capabilities

### New Capabilities
- `voice-assistants`: system voice assistants (Siri / Shortcuts now; Google Assistant in #418, hands-free mode in #416) acting on sessions and permissions.

### Modified Capabilities
<!-- none: notification actions and the short-lived connection keep their behavior -->

## Impact

- New: `apps/mobile/modules/voice-assistant/` (Expo module: Swift bridge, JS API; intent sources and `.xcstrings` copied into the app target), `apps/mobile/src/features/assistant/` (request handler, session list for Siri), config plugin in `app.config.ts`.
- `apps/mobile/index.ts` registers the assistant handler at module scope (like `push/background.ts`).
- No protocol or daemon change: uses `sessions.list`, `permissions.list`, `session.input` and `permission.respond`.
- Native build change (new binary needed; older binaries simply have no intents).
