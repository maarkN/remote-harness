## Why

The app goes to the stores under the publisher Alvyn Tech, and a store app's identifier can never change once published (Google Play keeps the package name forever). The current id, `tech.doctorx.clauderemote`, carries neither the publisher nor the product name, so it has to change now, before the first upload.

## What Changes

- The iOS bundle identifier and the Android package become `com.alvyntech.remoteharness` (`APP_ID` in `app.config.ts`). The widget extension and its App Group follow from it (`expo-widgets`).
- Installed builds with the old id are a separate app: the new one installs next to them, starts empty and is paired again; over-the-air updates for the new id never reach the old builds (the fingerprint changes anyway).
- The troubleshooting page (three languages) says the store build is a separate app and names both ids; CONTRIBUTING's Firebase step and `make install-ios`'s launch use the new id; test fixtures follow.
- Unchanged on purpose: the daemon's launchd label (`tech.doctorx.claude-remote`, a macOS service already installed on users' machines, not the app id), the URL schemes, the Android notification channel and the data directory.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `store-distribution`: the app identifier is `com.alvyntech.remoteharness` on both stores.

## Impact

`apps/mobile/app.config.ts`, `Makefile`, `CONTRIBUTING.md`, `apps/web/content/*/troubleshooting.md`, test fixtures (`ios-link-files.test.ts`, `app-link.test.ts`). Ops, before the next build: register iOS and Android apps with the new id in the Firebase project (APNs key on iOS; App Check if enforced) and replace `GoogleService-Info.plist` / `google-services.json`; let Xcode create the new App ID and App Group (`-allowProvisioningUpdates`) or create them in the Apple developer portal; publish OTA updates for the new runtime only after the new builds exist.
