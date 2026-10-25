## 1. Daemon

- [x] 1.1 `buildLiveMessage`: `input-push-token: 1` in the `start` payload only (tests in `live-follows.test.ts`).
- [x] 1.2 `LiveStatusService.register` keeps the previous entry's palette when the registration has none (tests).
- [x] 1.3 Push-started path tests in `live-follows.test.ts`: nothing but `start` while awaiting; a later register with the activity token sends the current status at once with that token and the follow's palette; waiting with the pending permission, done and end reach the activity afterwards.

## 2. Native (`expo-widgets` patch)

- [x] 2.1 `onExpoWidgetsActivityPushToken { activityId, pushToken, url }`: alive activities' tokens, then `activityUpdates` → `pushTokenUpdates`, one task per activity, cancelled on stop observing.
- [x] 2.2 `addActivityPushTokenListener` in `src` and `build` (JS + types); patch committed with `pnpm patch-commit`.

## 3. App

- [x] 3.1 Shared short-lived client helper (`withShortLivedClient`) used by `respondInBackground`.
- [x] 3.2 `background-register.ts`: pure planner in `logic.ts` (session from the deep link, skip in front, once per activity token) with Vitest cases, and the register over the short-lived client with FCM token and relay grant.
- [x] 3.3 `background.ts` subscribes on iOS at module scope (activity tokens and Deny / Allow); the Deny / Allow listener leaves `useLiveStatus`.

## 4. Validation

- [x] 4.1 `turbo run typecheck test`, Biome, `npx expo export --platform ios` and an `ExpoWidgets` simulator build green.
