## 1. Native module

- [x] 1.1 `modules/hands-free-background`: `expo-module.config.json`, `index.ts` (`requireOptionalNativeModule`, `start(texts)`, `stop()`, `release()`, events `onStop` / `onTalk`)
- [x] 1.2 iOS Swift: audio session (playback, spoken audio, duck others), silent `AVAudioEngine` keep-alive with restart on configuration change / interruption end, Now Playing info and remote commands (pause/stop → `onStop`, play/toggle → `onTalk`), `release` back to playback, `stop` tears down and deactivates
- [x] 1.3 Android Kotlin: `HandsFreeService` (foreground, type microphone|mediaPlayback, low-importance channel, ongoing notification with Stop action and tap-to-open), module `start`/`stop`, Stop action → `onStop`; manifest permissions and service
- [x] 1.4 `app.config.ts`: `withHandsFreeBackground` merges `audio` into `UIBackgroundModes`

## 2. App logic

- [x] 2.1 `features/hands-free/store.ts`: active session, phase, last said, `talk`/`repeat`, `start(sessionId)` / `stop()`; tests
- [x] 2.2 `features/hands-free/background.ts`: `IDLE_TIMEOUT_MS`, `idleDeadline`, `announces` (mute rule in the background), `backgroundTexts`, `reportedForeground`; tests
- [x] 2.3 `conversation/store.ts`: `session.unsubscribe` only when the last subscriber of a stream leaves; test
- [x] 2.4 `use-hands-free.ts`: own transcript subscription, speech through the application audio session, `release` after listening, mute rule and idle timeout in the background, native start/stop and `onStop`/`onTalk`
- [x] 2.5 `HandsFreeRunner` in the root layout; `HandsFreeSession` and the session screen read the store (menu label, bar)
- [x] 2.6 `push/use-push.ts`: report `app.visibility` as foreground while hands-free is on, re-report on change

## 3. Texts and docs

- [x] 3.1 i18n pt-BR, en-US, es-ES: lock-screen/notification texts, Stop, channel name, idle-off sentence
- [x] 3.2 Web docs `using-the-app.md` (three languages): background behavior, lock-screen control, idle timeout, mute rule, store build needed

## 4. Verify

- [x] 4.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
