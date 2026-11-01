## ADDED Requirements

### Requirement: Store screenshots
The store screenshots SHALL be taken from the in-app offline demo, in pt-BR, en-US and es-ES, and MUST show only its fictional data: no real project, path, host name or conversation. A screenshot build, chosen at build time with `REMOTE_HARNESS_SCREENSHOTS=1`, SHALL put `screenshots: true` in the Expo config's `extra`; in that build the app SHALL open the offline demo by itself from the pairing screen once start-up has settled, and SHALL NOT render the demo banner nor the Settings Demo card, so the fictional computer passes for a paired one. Without the variable the config and the app MUST be unchanged, and a screenshot build MUST NOT be shipped. A script (`pnpm --filter @remote-harness/mobile store:screenshots`) SHALL drive an iOS simulator or an Android emulator through the storyboard scenes (session list, permission request, conversation, raw terminal, new session, settings) by deep link, set a clean status bar and the app's language per run, and save the raw captures under `apps/mobile/store/screenshots/<platform>/<locale>/`, which MUST be ignored by git; `--scenes`, `--locales`, `--name`, `--out` and `--wait` SHALL select a subset of scenes and languages, the file prefix, the folder and the timing.

#### Scenario: Screenshot build
- **WHEN** the app is built with `REMOTE_HARNESS_SCREENSHOTS=1` and opened on a simulator with no paired computer
- **THEN** the demo's session list appears by itself, without the demo banner, and Settings shows no Demo card

#### Scenario: Shipping build
- **WHEN** the app is built without the variable
- **THEN** `extra` has no `screenshots` key, the pairing screen waits for the user and the demo shows its banner

#### Scenario: Capture run
- **WHEN** the maintainer runs `store:screenshots` with `--android --apk <release apk>` against a booted emulator
- **THEN** `store/screenshots/android/<locale>/` holds one PNG per scene for each of the three languages
