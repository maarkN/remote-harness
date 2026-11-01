## 1. Screenshot build

- [x] 1.1 `REMOTE_HARNESS_SCREENSHOTS=1` → `extra.screenshots: true` in `app.config.ts`; `screenshotBuild(extra)` reader with tests; `isScreenshotBuild()` in `demo-mode.ts`
- [x] 1.2 `DemoBanner` and `DemoCard` render nothing in a screenshot build; the pairing screen opens the demo by itself after start-up settles

## 2. Demo connection

- [x] 2.1 30 s direct-connect timeout for the demo's in-memory socket only

## 3. Capture script

- [x] 3.1 `scripts/store-screenshots.mts` (`store:screenshots`): iOS and Android drivers, status bar, language per run, scenes by deep link, relaunch when the demo's first connection fails, options `--scenes`/`--locales`/`--name`/`--out`/`--wait`/`--serial`/`--udid`/`--apk`/`--app`/`--prepare`/`--blind`
- [x] 3.2 `store/screenshots/` ignored by git; CONTRIBUTING "Screenshots" documents the build and the script

## 4. Verification

- [x] 4.1 Typecheck, tests and Biome; Android run on an Android 17 emulator (phone and tablet sizes, three languages) checked by eye; the iOS driver is written from the `simctl` commands but still to run on a Mac whose simulator renders
