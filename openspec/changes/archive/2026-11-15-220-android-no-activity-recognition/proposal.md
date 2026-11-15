## Why

The 1.2.0 Android bundle asks for `android.permission.ACTIVITY_RECOGNITION`. `expo-sensors`, added for "Shake to report", declares it in its library manifest for its pedometer, and Android merges it into the app. The app only reads the accelerometer, which needs no permission. Google Play treats `ACTIVITY_RECOGNITION` as a Health Connect permission and holds the release until a health-use declaration is filled in, and the app has no health use to declare.

## What Changes

- `android.permission.ACTIVITY_RECOGNITION` joins the Android blocked permissions in `app.config.ts`, so the merged manifest removes it. Shake to report keeps working, because it reads only the accelerometer.
- "Shake to report" states that it reads only the accelerometer and that the Android app does not declare the activity recognition permission.
- Release v1.2.1 (Android `versionCode` 1002001), because Google Play already has a 1.2.0 bundle (1002000).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `error-reports`: "Shake to report" reads only the accelerometer, and the Android app does not declare `ACTIVITY_RECOGNITION`.

## Impact

- **Code:** `apps/mobile/app.config.ts` (blocked permissions, version), `apps/mobile/scripts/app-config.test.ts`.
- **Version:** 1.2.1 in the daemon, the protocol package and the app.
- **Store:** a new Android bundle (1002001) replaces the 1.2.0 draft on Google Play, and the Health apps declaration is no longer required. iOS has no such permission; the 1.2.0 build stays on TestFlight.
