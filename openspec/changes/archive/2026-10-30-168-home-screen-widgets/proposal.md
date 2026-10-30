## Why

The app only reaches the phone's surfaces through notifications and the Live Activity of a running session. There is no glanceable place that answers "does anything need me?" without opening the app: no Home Screen or Lock Screen widget on iOS (#427) and no home screen widget on Android (#428). A pending permission, in particular, should be answerable from the home screen with the app closed, as it already is from the Live Activity and the notification.

## What Changes

- **Widget snapshot** (app): one content-free-for-push, on-device snapshot of the active computer, built by a pure function from the sessions, the pending permission requests and the usage limits: how many sessions wait for the user and how many run, up to three sessions (state, title, since when; a pending permission first), the oldest pending permission that can be answered with one tap, and the 5-hour and weekly usage limits. Texts arrive translated (pt-BR, en-US, es-ES) and colors come from the app theme, since widgets cannot read either.
- **iOS widgets** (WidgetKit through `expo-widgets`, in the existing widget extension): small (waiting and running counts; a tap opens the list), medium (up to three sessions, pending permission highlighted, Deny / Allow for the oldest one) and Lock Screen accessories (circular: waiting count; rectangular: counts and usage limits; inline: counts). Deny / Allow run in the app's process like the Live Activity buttons (`LiveActivityIntent`), so they are answered with the app closed.
- **Android widgets** (`react-native-android-widget`, RemoteViews): small (2×2) and medium (4×2) with the same content and actions; taps run as a headless task through WorkManager, so Allow / Deny work with the app closed and sessions open by deep link.
- **Keeping them fresh**: the app publishes the snapshot whenever its data changes while it runs and when it goes to the background; after a widget answer it refreshes over a short-lived connection. The daemon sends a **content-free widget refresh push** (data only, no title, no session content) to phones that registered `widgets: true` when the counts or the set of pending requests change, coalesced; the phone then fetches the data itself over the encrypted connection, so titles never travel through push.
- **Localized widget gallery** names and descriptions in the three languages on both platforms.

## Capabilities

### New Capabilities
- `home-widgets`: widget snapshot, iOS Home Screen and Lock Screen widgets, Android home screen widgets, actions and refresh.

### Modified Capabilities
- `push-notifications`: `widgets` flag in the device registration and the content-free widget refresh push.

## Impact

- Protocol: optional `widgets` on `device.register`.
- Daemon: `features/widgets` (signature of what widgets show, coalesced refresh push), `PushMessage.silent` in the sender, `widgets` stored with the device registration; tests.
- App: `src/features/widgets` (pure snapshot builder with tests, iOS layout, Android layout, publishing hook, background refresh and answers), `push/background.ts` (widget actions and refresh pushes on both platforms), `device.register` with `widgets: true`, i18n keys in the three catalogs, `app.config.ts` (widgets in the `expo-widgets` plugin, `react-native-android-widget` plugin, localized gallery strings, background remote notifications on iOS), `expo-widgets` patch (widget buttons whose target starts with `app:` run in the app's process).
- New native dependency `react-native-android-widget`: the app needs a new build; the version moves to 1.0.1.
