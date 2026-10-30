## Context

App Intents run inside the app process, but everything that talks to the computer lives in JavaScript (the Noise channel, credentials, the short-lived connection used by notification actions). `expo-widgets` already crosses that boundary for Live Activity buttons: an intent posts a `NotificationCenter` notification, and an Expo module forwards it to JS as an event. Intents also need their metadata extracted at build time, which only happens for Swift compiled into the app target, and React Native starts from the scene delegate (`withSceneLifecycle`), so a background launch without a scene has no JS runtime.

## Goals / Non-Goals

**Goals:** Siri / Shortcuts can reply, answer a plain permission and tell what is waiting, with spoken results in the app language; no protocol or daemon change.

**Non-Goals:** answering interactive questions or plans by voice (they need choices; #416), Android (#418), several computers in one phrase (the active computer only), reading conversation content aloud.

## Decisions

1. **Intents in the app target, bridge in a local Expo module.** `modules/voice-assistant/app-intents/*.swift` and two string catalogs are copied into `ios/<App>/AppIntents/` and added to the app target by a config plugin (metadata extraction works; nothing hand-edited in `ios/`). The module (`VoiceAssistantModule`, autolinked from `modules/`) only bridges: it observes request notifications, queues them until JS listens, forwards them as `onRequest` events, posts the JS answer back (`complete`) and stores the session list for Siri (`setSessions`, `UserDefaults`). The intents never import the module; both sides talk through notifications with a request id.
2. **Delivery handshake.** The intent posts the request and re-posts it every 0.5 s until the module acknowledges it (the module dedupes by id). If there is no acknowledgement within 2 s, the JS runtime is not running: on iOS 17+ the intent asks to continue in the foreground (`ForegroundContinuableIntent`), which connects a scene and starts React Native, and the re-posting goes on; on iOS 16 it answers that the app must be opened. The whole request times out at 15 s with a localized native sentence.
3. **JS does the work and the wording.** `src/features/assistant/handler.ts` (pure, injected client and `t`) turns a request into protocol messages over one short-lived connection to the active computer (`sessions.list` / `permissions.list`, then `session.input` or `permission.respond`) and returns `{ ok, message }`, the sentence Siri speaks, from the i18n catalogs. Only sentences that must exist without JS (timeout, open the app) live in the native catalog.
4. **Two-step permission answer.** The intent first asks JS for the oldest plain permission (`pending`), uses its description in `requestConfirmation`, then sends `answer` with that request id, so the confirmed request is the one answered even if another arrives meanwhile.
5. **Session list for Siri.** A hook in the app shell writes the active computer's sessions (not ended, not read-only, waiting first then most recent, at most 30) whenever the sessions store changes; `SessionEntity` queries read it. Choosing the default session runs in JS at request time from a fresh `sessions.list`.
6. **Unlock required.** All three intents use `authenticationPolicy = .requiresAuthentication`, matching notification actions (`isAuthenticationRequired`).

## Risks / Trade-offs

- `ForegroundContinuableIntent` is deprecated in the iOS 26 SDK in favor of `supportedModes`; it still works and keeps iOS 17–25 covered. → Revisit when the deployment target moves to 26.
- The session list can be stale when the app has not run for a while. → The intent still sends to the chosen id; JS re-checks the session with `sessions.list` and says when it ended or is read-only.
- Siri phrases are static: changing them needs a new binary (not OTA).

## Migration Plan

Native change: ships with the next build. OTA updates on older binaries detect the missing module (`requireOptionalNativeModule`) and skip the handler.
