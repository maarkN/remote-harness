## 1. Decision

- [x] 1.1 ADR `docs/adr/0008-problem-reports-upload-to-the-site.md` (destination, what is collected and when, retention, limits, no sealing); verify it reads as the other ADRs

## 2. Protocol and daemon

- [x] 2.1 `diagnostics.logs` / `diagnostics.logs.result` in `packages/protocol` with a parse test; verify the protocol tests pass
- [x] 2.2 Tests first for the pure scrubber and the tail reader (`apps/daemon/test/log-scrub.test.ts`): sensitive JSON keys, emails, tokens, IPs, long runs, the home folder, a 2 MB file cut at a line start, missing files; verify they fail
- [x] 2.3 `features/diagnostics/logs.ts` (tail + scrub) and the `diagnostics.logs` handler; verify the tests of 2.2 and the daemon tests pass

## 3. Site

- [x] 3.1 Tests first (`apps/web/test/reports.test.ts`): 201 and the stored file, 413, 415 (type and non-zip body), 429 on the sixth upload from an address, 507 over the quota, 405 for GET, the sweep of folders older than 30 days; verify they fail
- [x] 3.2 `POST /api/reports` route, `FsReportsStore` (atomic writes under `reports/`), the rate limiter, the sweep at start and every 6 hours, `deploy.sh` creating `data/reports`; verify the tests of 3.1 and the web tests pass

## 4. App

- [x] 4.1 `npx expo install expo-sensors react-native-view-shot expo-audio` and `fflate`; verify `expo-doctor`-relevant typecheck and that `pnpm-lock.yaml` only gains these
- [x] 4.2 Pure shake detector (`shake.ts`) with Vitest (three peaks in a second, one peak, cooldown); verify it passes
- [x] 4.3 Pure report assembly (`bundle.ts`): zip entries for `report.json`, logs and numbered attachments, the 25 MB budget, the GitHub body with the report ID; Vitest with fflate unzipping the result; verify it passes
- [x] 4.4 Shake listener and floating button (release builds, foreground, setting on, modules present), screenshot without the button, opening the report with it; the setting next to "Report a problem" in Settings (persisted); verify typecheck
- [x] 4.5 Report screen: attachments (library images/videos, camera, the screenshot), audio note (record, stop, play, remove), the computer's logs (opt-in, shown), Send uploading the zip and showing the ID, hidden with Never; texts in pt-BR, en-US and es-ES; verify typecheck and the i18n parity tests

## 5. Docs

- [x] 5.1 `privacy.md` (what a report uploads, when, retention, deleting one) and `using-the-app.md` (shake, attachments, logs) in en-US, pt-BR and es-ES; verify the web docs tests pass

## 6. Verification

- [x] 6.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [x] 6.3 Release build on the iOS simulator (iPhone SE, pt-BR, demo): the report screen shows Attachments (Photos or videos, Camera, Record an audio note), a photo from the library is listed with its size and a remove button and counts against the 24 MB budget, the logs switch, and the privacy note next to Send (the shake itself needs a device: the simulator has no accelerometer)
- [ ] 6.2 Pending: a release build on an iPhone and an Android phone: shake shows the button, the screenshot is attached, a photo, a video and an audio note are added, the computer's logs are shown, Send returns an ID and the zip is on the server; the setting turns the shake off
