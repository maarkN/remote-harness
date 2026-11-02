## Why

Hands-free (#416) only works while the session screen is open and the phone awake: with the screen locked or the app in the background nothing is read aloud and nothing listens, which defeats the bike and walking use case it was made for (#446). The mode must keep reading and answering while the phone is in a pocket, and the user needs a way to stop it from the lock screen.

## What Changes

- Hands-free runs for the whole app, not for the session screen: it keeps going when the user leaves the screen, locks the phone or switches apps, and stops only on Exit, "stop", the lock-screen control, the session ending or an idle timeout. Coming back to the session shows the bar as before.
- iOS: the app declares the `audio` background mode and, while hands-free is on, keeps a spoken-audio session active (ducking other audio) so speech and listening work with the screen locked. The lock screen and Control Center show a Now Playing card ("Hands-free is on · <session>") whose pause/stop control turns the mode off; the headset play/pause button acts as Talk.
- Android: while hands-free is on, a foreground service keeps the app alive with a persistent notification ("Hands-free is on · <session>") that has a **Stop** action and opens the session on tap.
- While the app is in the background, hands-free honors the mute rules (a muted session or profile is not read aloud; its requests stay on the screen) and turns itself off after 30 minutes without anything to read or hear, saying so.
- While hands-free is on, the app reports itself as in the foreground to the computer, so no push duplicates what is read aloud; if the app dies, the connection drops and pushes resume.
- Binaries without the new native module (an over-the-air update) keep today's behavior: hands-free works with the app open and stops when the app is suspended.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hands-free`: "Hands-free mode" no longer stops when the user leaves the session screen; new requirements for working in the background, the lock-screen stop control, the idle timeout and the mute rule.
- `push-notifications`: "Push delivery" counts a client with hands-free on as in the foreground.

## Impact

- New local Expo module `apps/mobile/modules/hands-free-background` (Swift: `AVAudioSession`, a silent `AVAudioEngine` keep-alive, `MPNowPlayingInfoCenter` / `MPRemoteCommandCenter`; Kotlin: a foreground service of type `microphone|mediaPlayback` with its notification). The fingerprint runtime version changes, so it ships in a store build, not over the air.
- `app.config.ts`: `UIBackgroundModes` gains `audio`; the module's manifest adds the foreground-service permissions and the service.
- `apps/mobile/src/features/hands-free`: a store for the active session, a runner mounted in the root layout, the hook gains the background rules; `HandsFreeSession` and the session screen read the store; `features/conversation/store.ts` sends `session.unsubscribe` only when the last subscriber of a stream leaves; `features/push/use-push.ts` reports visibility with hands-free in mind.
- i18n in pt-BR, en-US and es-ES; web docs (`using-the-app.md`, three languages); no protocol or daemon change.
