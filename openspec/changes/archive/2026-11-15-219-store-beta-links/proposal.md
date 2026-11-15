## Why

The app is now on TestFlight (public link `https://testflight.apple.com/join/Vkh3K19G`) and on Google Play's testing track (#161). The landing's "Get the app" cards still send iPhone & iPad visitors to the ad-hoc install link, which installs only on devices registered in the developer team. The Android card opens the generic testing page rather than the one the Play Console gives for the current build. The getting started docs and the README still say the app is not in the stores yet.

## What Changes

- The iPhone & iPad card opens the TestFlight public link and says it installs from TestFlight (beta), in pt-BR, en-US and es-ES. The note about device registration goes away from the landing. The link is public, so it is a fixed link in the repository like the Android one.
- The Android card opens `https://play.google.com/apps/test/com.alvyntech.remoteharness/10`, the testing link from the Play Console.
- **BREAKING** (ops only): the landing no longer reads `APP_INSTALL_URL`. The server stops reading it, and `make deploy-web` stops writing it to the server's `.env`. The ad-hoc install link page (`/app/<token>/`) keeps working for registered devices and is shared directly.
- Getting started (three languages) lists TestFlight first for iPhone & iPad, with the ad-hoc link for registered devices and building from source as alternatives. The registration section no longer says "until the app is on TestFlight". The Android link matches the card. The README (two languages) says the app installs from TestFlight and Google Play (testing).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-landing`: "Install section" is replaced by "Install section with the store links", which names where both app cards go.
- `web-hosting`: "Site server" no longer reads the app install link; "Docker deploy" is replaced by "Docker deploy of the site", which no longer writes it.

## Impact

- **Site code:** `apps/web/src/{landing,site,app,main}.ts`, `apps/web/src/i18n/{en-US,pt-BR,es-ES}.ts`.
- **Deploy and config:** `apps/web/scripts/deploy.sh`, `apps/web/deploy/compose.yml` (comment), `Makefile` (comment).
- **Content and docs:** `apps/web/content/*/getting-started.md`, `README.md`, `README.pt-BR.md`.
- **Tests:** `apps/web/test/{landing,server}.test.ts`.
- **Ops:** after the deploy, the `APP_INSTALL_URL` line left in the server's `.env` is unused and can be removed.
