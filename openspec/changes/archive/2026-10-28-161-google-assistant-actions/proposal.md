## Why

Android has no voice entry point besides dictation and the "Reply by voice" notification action: Google Assistant cannot send a message to a session, answer a permission or say what is waiting, which #417 added on iOS with Siri (#418, part of the hands-free work in #416).

## What Changes

- App Actions (`shortcuts.xml`) for Google Assistant:
  - `actions.intent.CREATE_MESSAGE` ("Send a message on Remote Harness"): text and, optionally, the session by title.
  - Custom intents to allow or deny the pending permission and to check what is waiting, with query patterns in en-US, pt-BR and es-ES.
- Each action opens the app on a `remoteharness://assistant/…` link handled by a new screen: replies are sent (or the session opens with the composer focused when there is no text), permissions show the request with Allow / Deny to confirm, and "what's waiting" shows the summary. The screen reuses the request handler from #417 and announces the result to screen readers.
- Dynamic launcher shortcuts for the most recent live sessions (long press on the app icon → reply), fed by the same on-device session list as Siri.
- Docs: which Android / Assistant versions support App Actions and what opens the app.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `voice-assistants`: adds Google Assistant actions and launcher shortcuts on Android.

## Impact

- `apps/mobile/modules/voice-assistant`: Android part of the module (dynamic shortcuts from `setSessions`).
- `app.config.ts`: config plugin writing `res/xml/shortcuts.xml`, the query pattern arrays per language and the `android.app.shortcuts` meta-data on the launcher activities (main activity and icon aliases).
- New route `src/app/(main)/assistant/[action].tsx` and `src/features/assistant/AssistantLinkScreen.tsx`; pure link parsing with tests.
- No protocol or daemon change; native build needed (older binaries ignore the links).
