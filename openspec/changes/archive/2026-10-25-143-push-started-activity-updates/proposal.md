## Why

A Live Activity the daemon starts by push for a followed session (iOS 17.2+) stays frozen on its first frame until the app is opened: no steps, counts or todo progress, and no "Waiting for you" with Deny / Allow (#348). The daemon keeps reducing the status but sends nothing until the app registers the new activity's own update token, which today only the mounted React tree does.

## What Changes

- The push-to-start payload asks iOS for the activity's update token right away (`input-push-token: 1`, iOS 18+; older iOS ignores it).
- `expo-widgets` (patch) observes new activities and their push tokens natively (`Activity.activityUpdates` → `pushTokenUpdates`, plus the activities already alive) and emits one event per token with the activity id and its deep link.
- A module-scope handler in the app's background entry (no router, no React) turns that event, when the app is not in front, into `live.register` with the activity token over a short-lived authenticated connection, the same way permissions are answered from the lock screen. The session comes from the activity's deep link.
- Deny / Allow on a Live Activity is listened to at module scope too, so it is answered when iOS runs the app in the background without mounting the screens.
- The daemon keeps a session's palette (and the turn it tracks) when a registration for the same session comes without one, so the background registration keeps the colors the follow carried.

## Capabilities

### New Capabilities

### Modified Capabilities

- `live-status`: Follow a session — a push-started Live Activity keeps updating with the app closed once iOS hands its token to the app in the background; the update token is requested in the start payload.

## Impact

- `apps/daemon/src/features/push/sender.ts` (`input-push-token` on `start`), `apps/daemon/src/features/live-status/service.ts` (palette kept on re-register); tests in `sender.test.ts` and `service.test.ts`.
- `patches/expo-widgets@57.0.26.patch` (native activity token observer and `addActivityPushTokenListener`); needs a new native build (an OTA update alone keeps the old behavior).
- `apps/mobile/src/features/live-status/background-register.ts` (new), `apps/mobile/src/features/push/background.ts`, `respond-in-background.ts` (shared short-lived client), `use-live-status.ts`.
- No protocol change.
