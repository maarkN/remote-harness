## Why

The store screenshots must show only the fictional demo, in pt-BR, en-US and es-ES (#161), but the in-app offline demo (#395) shows the "Demo" banner on every main screen and a Demo card in Settings, and it has to be entered by hand from the pairing screen on every launch. Taking the storyboard's scenes in three languages on two form factors by hand is a few hundred taps, and every capture would carry the banner (issue #481).

## What Changes

- **Screenshot build**: `REMOTE_HARNESS_SCREENSHOTS=1` at build time puts `screenshots: true` in the Expo config's `extra`. In that build the pairing screen opens the offline demo by itself once start-up has settled, and the demo banner and the Settings Demo card are not rendered, so the fictional computer passes for a paired one. Without the variable nothing changes; a screenshot build is never shipped.
- **Demo handshake on a slow start**: the demo's in-memory connection gets a 30 s direct-connect timeout instead of the network default (3 s), which a cold start on a slow emulator missed ("pairing rejected", empty list).
- **Capture script** `pnpm --filter @remote-harness/mobile store:screenshots`: drives an iOS simulator (`simctl`) or an Android emulator (`adb`) through the storyboard scenes (session list, permission request, conversation, raw terminal, new session, settings) by deep link, per language, with a clean status bar (time, full battery, Wi-Fi, no notifications) and the app's language set per run, and saves the raw captures under `apps/mobile/store/screenshots/<platform>/<locale>/`, ignored by git. `--scenes`, `--locales`, `--name`, `--out` and `--wait` select subsets, the file prefix, the folder and the timing.
- CONTRIBUTING "Screenshots" documents the build and the script.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `store-distribution`: a new requirement for the store screenshots (demo only, screenshot build, capture script).
- `demo-mode`: the banner and the Demo card are not shown in a screenshot build, where the demo opens by itself.

## Impact

`apps/mobile/app.config.ts` (`extra`), `src/features/demo` (`screenshot-build.ts` with tests, `demo-mode.ts`, `DemoBanner.tsx`, `DemoCard.tsx`), `src/features/pairing/PairScreen.tsx`, `src/core/connection/connection-store.ts`, `scripts/store-screenshots.mts`, `package.json`, `.gitignore`, CONTRIBUTING. No protocol or daemon change; no i18n change (nothing new is shown).
