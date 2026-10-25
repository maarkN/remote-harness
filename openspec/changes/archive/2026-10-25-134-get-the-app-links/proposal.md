## Why

The landing's "Get the app" cards point to the old places (#347): Android still opens GitHub Releases although the app is now on Google Play's testing track under `com.alvyntech.remoteharness`, and the live site shows "Build from source" for iPhone & iPad because the server has no `APP_INSTALL_URL`, while an over-the-air install page already exists.

## What Changes

- The Android card opens Google Play's testing page, `https://play.google.com/apps/test/com.alvyntech.remoteharness`, and says it installs from Google Play (testing), in pt-BR, en-US and es-ES.
- Getting started (three languages) lists Google Play (testing) first for Android, keeping the APK from GitHub Releases and building from source as alternatives.
- iPhone & iPad: no code change; the card already opens the install link when the server has `APP_INSTALL_URL`. The owner sets it on the next deploy (`make deploy-web APP_INSTALL_URL=/app/<token>/`); the token stays out of the repository.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-landing`: "Install section" names where the Android card goes.

## Impact

`apps/web/src/landing.ts`, `apps/web/src/i18n/{en-US,pt-BR,es-ES}.ts`, `apps/web/content/*/getting-started.md`, `apps/web/test/landing.test.ts`. Ops: `make deploy-web` with `APP_INSTALL_URL` to publish both cards.
