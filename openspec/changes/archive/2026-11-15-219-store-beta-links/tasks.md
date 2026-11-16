## 1. Landing

- [x] 1.1 `LINKS.ios` (TestFlight public link) and `LINKS.android` (the Play Console testing link with `/10`); the iPhone & iPad card always opens TestFlight; `install.ios` keeps `title` and `detail` ("TestFlight (beta) · iOS 17+") in pt-BR, en-US and es-ES, without `source` and `note`
- [x] 1.2 Remove `SiteConfig` / `siteConfig` and the `site` dependency from `createApp`, `renderLanding` and `main.ts`
- [x] 1.3 Landing and server tests: both cards' links and texts in the three languages; no registration note on the landing

## 2. Deploy

- [x] 2.1 `deploy.sh` without `APP_INSTALL_URL`; the compose and Makefile comments no longer mention it

## 3. Docs

- [x] 3.1 Getting started (three languages): TestFlight first for iPhone & iPad, the ad-hoc link for registered devices and building from source as alternatives; the Android link matches the card
- [x] 3.2 README (en-US, pt-BR): the app installs from TestFlight and Google Play (testing)

## 4. Verify

- [x] 4.1 Typecheck, tests, Biome and `openspec validate --strict`
