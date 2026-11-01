## Context

The README screenshots come from the daemon's demo sandbox (`pnpm --filter @remote-harness/daemon demo`) paired with the app on a simulator (`scripts/screenshots.mts`). The store needs the same scenes in three languages on phones and tablets, and the in-app offline demo already has the same fixtures without a daemon; what stands in the way is its banner, its Settings card and the manual entry on every launch.

## Goals / Non-Goals

**Goals:** captures of the storyboard scenes from the offline demo, in pt-BR, en-US and es-ES, without the banner, reproducible from one command per platform; shipping builds untouched.

**Non-Goals:** composing the captures onto the store canvases (frames, captions), the scenes that need typing or the lock screen (the prompt with hands-free, the live status), uploading to the stores.

## Decisions

- **A build-time flag, not a runtime toggle.** `REMOTE_HARNESS_SCREENSHOTS=1` is read by `app.config.ts` and lands in `extra.screenshots` only when set; the app reads it through one pure function (`screenshotBuild(extra)`, tested). A hidden runtime switch would exist in shipping builds; a separate app variant would double the build matrix.
- **Auto-start after 2 s.** The pairing screen starts the demo and replaces the route once start-up has settled: the demo's Noise handshake runs on the JavaScript thread, and on a cold start it competed with the first render and timed out.
- **Longer direct timeout for the demo only.** The in-memory socket has no relay to race, so the 3 s direct-connect budget (a network heuristic) is raised to 30 s just for the demo's `DaemonClient`; real connections keep 3 s.
- **Drivers per platform in one script.** iOS: `simctl` (install, `status_bar override`, `AppleLanguages`/`AppleLocale`, `openurl`, `io screenshot`). Android: `adb` (install, SystemUI demo mode for the status bar, `cmd locale set-app-locales` for the language, `am start -a VIEW` for the deep links, `screencap`). The scenes are the storyboard's; the demo session ids come from `@remote-harness/protocol/demo`.
- **Detecting the demo's state from pixels on Android.** `uiautomator dump` never returns while a session runs (the UI is never idle), so the script samples the capture's colours (the banner-high strip for a "pairing rejected" state, the chip row for a loaded list) and relaunches the app up to four times when the first connection fails; `--blind` skips it on sizes the sample is not calibrated for.
- **Raw captures only, ignored by git.** Composition onto the store canvases is a separate step; the raw PNGs are reproducible and would bloat the repository.

## Risks / Trade-offs

- [The demo's first connection fails intermittently on the emulator] → the relaunch loop; not seen on devices, the cause (start-up contention) is mitigated, not removed.
- [The iOS driver was written from the `simctl` commands but not exercised] → the simulator on the development machine cannot render (Metal); to be run on another Mac before the iOS captures.
- [A screenshot build could be mistaken for a shipping build] → the flag is a build-time environment variable, documented as never-ship; nothing in the store pipeline sets it.
