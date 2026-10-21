## Why

Issue #305: the landing's "Get the app → iPhone & iPad" card links to the README and says "Build from source today · TestFlight soon", although iOS builds are already published with an install link on remoteharness.app (`/app/<token>/`, `make install-ios-link IOS_LINK=web`). Visitors never find it, and nothing tells them the ad-hoc build only installs on registered devices.

## What Changes

- New server setting `APP_INSTALL_URL` (a path on the site such as `/app/<token>/`, or an https URL; anything else is ignored), read in `main.ts` into a `SiteConfig` passed to `createApp` and `renderLanding`. The token stays in the server's `.env`, never in the repository.
- With it, the iPhone & iPad card opens the install link and reads "Install over the air · registered devices · iOS 17+", followed by a note linking the docs section on device registration (or building from source). Without it, the card opens the getting started docs and keeps "Build from source today · TestFlight soon".
- Getting started docs (three languages): the iPhone & iPad bullet points to the card, and a new "Registering an iPhone or iPad" section explains the ad-hoc limit, how to find the UDID, sending it privately to the maintainer, and that building from source has no such list. The install link page's "registered devices" hint links to that section.
- `make deploy-web APP_INSTALL_URL=/app/<token>/` (deploy script) writes the value into the server's `.env`, replacing any previous one; it refuses a value that is not a path or an https URL. Documented in the Makefile, deploy script and compose file headers.
- The README link (`LINKS.ios`) is dropped.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-landing`: the iPhone & iPad card follows the configured install link; device registration docs.
- `web-hosting`: the server reads `APP_INSTALL_URL`; the deploy can set it in `.env`.

## Impact

`apps/web/src/site.ts` (`SiteConfig`, `siteConfig`), `app.ts`, `main.ts`, `landing.ts`, the three catalogs (`install.ios.source`, `install.ios.note`, `appLink.ios.registered`), `content/*/getting-started.md`, `scripts/deploy.sh`, `deploy/compose.yml`, `Makefile`, tests. Ops: the owner runs `make deploy-web APP_INSTALL_URL=/app/<token>/` once (the token is in `~/.remote-harness-builds/ios/.web-token`). Note that the link becomes public on the landing: anyone can download the builds, which only install on registered devices anyway.
