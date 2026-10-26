## Why

The only notification actions are Allow and Deny on permission requests; answering an agent that finished its turn means opening the app (#371). Replying, interrupting or releasing the queue from the notification closes that gap, now that the background responder talks to the computer directly over the Noise channel (#362, #366).

## What Changes

- The "agent finished" (`Stop`) and "waiting for you" (`Notification`) pushes of a controllable session get the category `TURN` (Reply, Reply by voice, Interrupt) or `TURN_QUEUE` (the same plus Send next queued) when the session has queued prompts. Permission pushes keep Allow / Deny only. The payload still carries no session content: the category is a fixed name.
- **Reply**: a text input action (iOS `UNTextInputNotificationAction`, Android `RemoteInput`, dictation from the keyboard works); the text goes from the device to the daemon as `session.input` (`auto`) through the background responder, never through the push relay.
- **Reply by voice**: opens the app on that session straight into the recording (existing continuous recording and voice polish) and sends when the recording ends.
- **Interrupt**: `session.key` Escape. **Send next queued**: new `queue.sendNext { sessionId }`, which delivers the head of the queue now.
- Every action requires unlocking: `isAuthenticationRequired` on iOS; on Android the turn notifications go to a channel whose lock-screen visibility is private, so their actions only show once unlocked.
- Android: the system draws FCM notification messages without buttons, so for devices that register with `turnActions: true` (`device.register`) the daemon sends these pushes as data messages and the app draws them with the category; older app builds keep the plain notification.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `push-notifications`: registration flag, turn categories, the actions and their unlock rule, Android data messages for turn pushes.
- `session-input`: `queue.sendNext`.

## Impact

- `packages/protocol`: `device.register.turnActions`, `queue.sendNext`.
- `apps/daemon`: `features/push` (category choice, data-only build for Android), `features/queue` (`sendNext`), wiring in `main.ts`.
- `apps/mobile`: `features/push` (categories, background handling of the new actions, Android drawing and channel), the composer's voice start from a link, i18n in pt-BR, en-US and es-ES; web docs.
- Siri / Google Assistant replies stay out of scope.
