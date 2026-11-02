## Context

Hands-free (#416) lives in `useHandsFree`, mounted by `HandsFreeSession` as the session screen's composer: leaving the screen unmounts it, and when the app is suspended (screen locked, another app in front) JavaScript stops, the socket dies and nothing is spoken. iOS only lets an app keep running in the background under a declared background mode; `audio` fits a mode whose purpose is to speak and listen, but the app must actually hold an active audio session (and produce or capture audio) or it is suspended within seconds. Android keeps a process alive with a foreground service, which needs a persistent notification and, since Android 14, a declared service type.

## Goals / Non-Goals

Goals:
- Keep reading turns, permissions and questions aloud, and listening for answers, with the screen locked or the app in the background, on iOS and Android.
- A visible way to stop from the lock screen without unlocking.
- Battery guard rails: idle timeout, mute rules, and letting the microphone go between listenings.
- Older binaries (OTA) keep working as today.

Non-Goals:
- Continuous listening (a wake word): Talk is still needed to say a message that nothing prompted for.
- A Live Activity for hands-free; the Now Playing card is the lock-screen surface on iOS.
- Several sessions in hands-free at once: turning it on for a session turns it off for the previous one.

## Decisions

1. **One runner for the whole app.** A `useHandsFreeStore` holds the active `sessionId`, `phase`, `lastSaid` and the `talk`/`repeat` callbacks; `HandsFreeRunner`, mounted once in the root layout inside `ConnectionProvider`, runs `useHandsFree` for the stored session and syncs the UI state back into the store. `HandsFreeSession` only renders the bar from the store; the session screen derives "on" from `store.sessionId === id`. The runner also keeps its own `subscribeTranscript` for the session, so turns keep arriving after the conversation screen is gone. Alternative rejected: keeping the hook in the screen and preventing unmount — fragile with Expo Router and still dies with the app.

2. **Transcript unsubscribe only from the last subscriber.** `subscribeTranscript` already counts open subscribers per stream (`open[key]`); the cleanup now sends `session.unsubscribe` only when that count reaches zero, otherwise the runner's stream would stop when the screen closes. The daemon keeps one subscription per connection and target, so no protocol change.

3. **Native module `HandsFreeBackground`** (`apps/mobile/modules/hands-free-background`, `requireOptionalNativeModule`: `null` on binaries without it), with `start(texts)`, `stop()`, `release()` and events `onStop`, `onTalk`. Texts (title, subtitle, Stop label, channel name) come from the app's catalogs so nothing is hard-coded natively.
   - iOS: `start` sets the shared `AVAudioSession` to `.playback` / `.spokenAudio` with `.duckOthers` and `.interruptSpokenAudioAndMixWithOthers`, activates it and runs an `AVAudioEngine` whose source node renders silence: that is what keeps the app scheduled under the `audio` background mode between utterances. It also publishes `MPNowPlayingInfoCenter` info and registers `MPRemoteCommandCenter` handlers: pause/stop → `onStop`, play/togglePlayPause (headset button) → `onTalk`. The engine is restarted on route/configuration changes and after interruptions. `release` re-applies the playback category after a listening ended (speech recognition switches the session to `.playAndRecord`, which keeps the microphone indicator on). `stop` tears everything down and deactivates the session, notifying others. Speech goes through the application session (`useApplicationAudioSession`).
   - Android: `start` launches `HandsFreeService` (`startForegroundService`) with a low-importance channel and an ongoing notification (small icon `notification_icon` when present, else the app icon; tap opens the app; a **Stop** action sends an intent back to the service, which stops itself and reports to the module → `onStop`). Service type `microphone|mediaPlayback`, declared with `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` in the module manifest. `release` is a no-op.
   - Alternative rejected: a silent-push driven design (wake on `content-available`, speak, sleep) — iOS throttles those pushes, so a permission could wait minutes.

4. **Background rules in the hook, as pure helpers.** `background.ts` holds `IDLE_TIMEOUT_MS` (30 min), `idleDeadline`, `announces(session, muted, foreground)` (muted sessions or profiles are not read while the app is in the background), `backgroundTexts(session, t)` and `reportedForeground(appState, handsFreeOn)`. The hook tracks the last activity (engine events and session state changes), and when the deadline passes in the background it says `handsFree.idleOff` and exits.

5. **Visibility to the daemon.** `use-push.ts` reports `app.visibility` with `foreground: appState === 'active' || handsFreeOn` and re-reports when the hands-free store changes, so the daemon skips the pushes for what the app reads aloud; a dead app means a dropped connection, and pushes resume.

6. **Config.** `withHandsFreeBackground` in `app.config.ts` merges `audio` into `UIBackgroundModes` (expo-notifications already adds `remote-notification`). Android needs nothing in the config: the module's manifest merges its permissions and service.

## Risks / Trade-offs

- iOS App Review may question the `audio` background mode: the mode's purpose is spoken audio the user asked for, the Now Playing card makes it visible, and the idle timeout bounds it. If a review rejects the silent keep-alive, the fallback is speaking only while the engine runs (today's behavior).
- Battery: an active audio engine and the kept socket cost power; the idle timeout and `release` (microphone off between listenings) bound it. The issue asks for a 30-minute measurement on a device, left as a manual check.
- Speech recognition and TTS share one audio session: the recognizer's `.playAndRecord` category stays until `release`, so speaking right after a listening uses that category (louder through `defaultToSpeaker`), which is acceptable.
- Android 14+ restricts starting a `microphone` foreground service from the background: hands-free is always turned on from the screen, so the service starts from the foreground.
- Google Play requires declaring the foreground service types in the console before a build with them is accepted (manual store step).

## Migration Plan

No data migration. The native module changes the fingerprint runtime version: the feature reaches phones with the next store build; OTA updates to older binaries get the store/runner refactor but `HandsFreeBackground` is `null`, so the behavior stays as today (the mode now survives leaving the screen but still stops when the app is suspended).

## Open Questions

- Whether a muted session should also be silent in the foreground (today it is read because the user turned the mode on for it); kept as is.
