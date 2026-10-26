## Context

`PushService.messageForHook` builds the `Stop` / `Notification` pushes; `buildMulticast` sends one FCM message with an `apns` block (where `category` goes) and an `android.notification` block (drawn by the system: no buttons). The Android live status already travels as data messages drawn by the app (`showLiveMessage`, background handler at module scope in `push/background.ts`). Allow / Deny go through `answerAction` → `respondInBackground` (short-lived Noise client).

## Goals / Non-Goals

**Goals:** the same four actions on both platforms; nothing new in the payload but a fixed category name; old app builds keep receiving every push.

**Non-Goals:** Siri / Google Assistant, replies with images, answering questions or plans from a notification.

## Decisions

- **Category chosen by the daemon.** A pure `turnCategory({ controllable, queued })` picks `TURN`, `TURN_QUEUE` or none; the push feature gets `turnInfo(sessionId)` from `main.ts` (session store + queue), so it does not import those features.
- **Android data messages behind a registration flag.** A data message is only drawn by an app that knows it; old builds would show nothing. `device.register.turnActions` marks builds that do, and `PushService.notify` sends those Android devices a data-only copy (`androidData`); the rest get the multicast as today. The relay already passes data messages (live status).
- **Unlock on Android.** expo-notifications has no per-action authentication on Android; a separate `turn` channel with `lockscreenVisibility: PRIVATE` hides the content and the actions on a secure lock screen. iOS actions use `isAuthenticationRequired`.
- **One action handler.** `answerAction` grows into a router of notification actions: Allow / Deny as before, Reply (`userText` → `session.input` `auto`), Interrupt (`session.key` Escape), Send next (`queue.sendNext`), each through `withShortLivedClient` on the notification's computer and deduplicated per notification + action (Android hands the same tap to the task and the listener). Reply by voice opens the app with `voice=1`; the composer starts recording on mount and sends after the transcript lands (also after the polish review).
- **`queue.sendNext` in the daemon** rather than an item ID in the push: the action sends whatever is first when tapped, and the push needs no queue identifiers.

## Risks / Trade-offs

- [Android data messages are not delivered to a force-stopped app] → only for builds that opted in; FCM high priority otherwise wakes the app. The live status already relies on this.
- [The queue may have been delivered automatically by the time Send next is tapped] → the daemon answers `not_found` and the app opens the session.
- [Private channel hides the turn notification's text on the lock screen] → the text is content-free anyway (generic title, profile name).
