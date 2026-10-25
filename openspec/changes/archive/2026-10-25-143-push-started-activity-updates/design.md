## Context

`startByPush` registers the session with `awaitingActivity: true` and sends nothing else until `live.register` arrives with the new activity's update token. The only code that sends it is `useLiveStatus` (registerActivity), inside the mounted app with a live connection. When iOS starts an activity from a push-to-start notification it gives the app background runtime to read the activity's token, but nothing at module scope listens for it, so the token never leaves the phone until the user opens the app.

## Goals / Non-Goals

**Goals:** a push-started activity gets steps, counts, waiting with Deny / Allow, done and dismissal with the app closed; opening the app adopts it as today.

**Non-Goals:** iOS 18 broadcast channels; starting activities on iOS older than 17.2; changing the throttle or the content.

## Decisions

1. **Native token observer + background registration (options 1 and 2 of #348).** The `expo-widgets` patch adds an event `onExpoWidgetsActivityPushToken` `{ activityId, pushToken, url }`. When JS starts observing it, a task reports every alive activity's current token and then follows `Activity<LiveActivityAttributes>.activityUpdates`, observing each new activity's `pushTokenUpdates` (one task per activity id, cancelled when observing stops). `background.ts`, loaded by `index.ts` before the router, subscribes at module scope on iOS. Each token, while the app is not active, becomes a `live.register { sessionId, platform: 'ios', fcmToken, activityToken, relay? }` over a short-lived `DaemonClient` with the saved credentials; the session id comes from the activity's deep link (`sessionIdFromActivityUrl`). With the app in front `useLiveStatus` already registers its activities. Repeated tokens for the same activity are sent once per JS runtime.
   - Rejected: native code talking to the daemon itself — it would duplicate the WebSocket protocol, the credentials and the relay grant (App Check) in Swift.
2. **`input-push-token: 1` in the start payload.** iOS 18 then issues the update token immediately and wakes the app for it, instead of whenever the system gets to it. iOS 17.2–17.x ignores the key and still delivers the token through `pushTokenUpdates`.
3. **Broadcast channels rejected.** FCM's `liveActivityToken` path has no channel support; channels would need direct APNs access and channel lifecycle in `apps/push-relay`, plus a per-activity fallback for iOS 17 anyway.
4. **The daemon keeps the palette on re-register.** The background registration has no reliable theme (the theme store is not restored in a background launch), so when a registration omits `palette` the daemon keeps the previous entry's one (the follow device's colors). The turn in progress is already kept.
5. **Deny / Allow listener at module scope.** `addUserInteractionListener` moves from the hook to `background.ts`, so a tap on the lock screen is answered even when iOS runs the app without mounting the screens; one listener avoids double answers.

## Risks / Trade-offs

- iOS decides when the app gets background time; a force-quit app or Low Power Mode can delay the token. The activity then still updates once the app runs, as today. → `input-push-token` narrows the window on iOS 18.
- The patch changes native code: needs a new binary; older binaries running a new JS bundle simply never get the event (the listener is wrapped in try/catch).
- Each background registration costs one relay grant request; the grant cache only lives for the JS runtime.
