## 1. Permission

- [x] 1.1 Add `android.permission.ACTIVITY_RECOGNITION` to `ANDROID_BLOCKED_PERMISSIONS` in `app.config.ts`, with the reason (the `expo-sensors` pedometer)
- [x] 1.2 Test that the Android config blocks it

## 2. Release

- [x] 2.1 Bump to 1.2.1 (daemon, protocol, app; Android `versionCode` 1002001)

## 3. Verify

- [x] 3.1 Typecheck, tests, Biome and `openspec validate --strict`
- [x] 3.2 The 1.2.1 bundle's manifest has no `ACTIVITY_RECOGNITION`
