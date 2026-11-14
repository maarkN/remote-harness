## Why

Reporting a problem exists (#69: Settings → Report a problem: a description, the device's error log, the computer's recent rejected requests, sent through Crashlytics, shared as a file or opened as a prefilled GitHub issue), but it is deep in Settings and text only: no screenshot, images, video or audio, and none of the computer's log files (#557). Crashlytics and the GitHub prefill take text only, and the site had no upload endpoint.

## What Changes

- **Shake to report**: in release builds, shaking the phone shows a floating "Report a problem" button for a few seconds; tapping it captures the current screen (without the button) and opens the report screen with that screenshot attached. Settings has a switch to turn it off (on by default); Settings → Report a problem stays as the way in without shaking. Development builds keep React Native's dev menu on shake.
- **Report screen**: besides the description, the user can attach images and videos (library or camera) and record an audio note, each removable, within a 25 MB total; and, opt-in and off by default, include the computer's logs, shown before sending.
- **Computer logs**: a new request, `diagnostics.logs`, answered by the daemon with the tail of its log files (`daemon.log`, `daemon.err.log`, `update.log`) after scrubbing them: secrets, tokens, keys, emails, IP addresses and long token-like runs are redacted, values of sensitive JSON keys too, and the home folder shortened to `~`. Session content, prompts and `command.run` input or output are never logged, so never there either.
- **Destination**: Send uploads the report as one zip (`report.json`, the logs when included, the attachments) to `https://remoteharness.app/api/reports` and shows the report ID, which the GitHub issue link then carries. The site keeps uploads in its data folder for 30 days, with no way to read or list them over HTTP; it caps each report at 25 MB, uploads per address at 5 an hour and the folder at 2 GB. Send replaces the Crashlytics send of this screen and, like it, is hidden with the "Never" preference; crash reports keep going through Crashlytics. Decided in ADR 0008; the privacy policy says it.
- New native modules (`expo-sensors`, `react-native-view-shot`, `expo-audio`): the feature reaches phones with the next store build, not over the air. The update runtime is the native fingerprint (`runtimeVersion: { policy: 'fingerprint' }`), so an OTA bundle that needs them is never served to an older binary.
- Texts in pt-BR, en-US and es-ES; Vitest for the pure parts (shake detection, log scrubbing, report assembly, the upload checks and the rate limit).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `error-reports`: "Report a problem" (attachments, computer logs, upload); new "Shake to report" and "Computer logs".
- `protocol`: "Daemon diagnostics" adds `diagnostics.logs`.
- `web-hosting`: "Data directory" adds `reports/`; new "Problem report uploads".

## Impact

- Protocol: `diagnostics.logs` (client) and `diagnostics.logs.result` (server).
- Daemon: `features/diagnostics/` (log tail and scrubbing), tests.
- App: `features/error-reports/` (shake detector, FAB, attachments, audio note, zip and upload), Settings switch, new dependencies (`expo-sensors`, `react-native-view-shot`, `expo-audio`, `fflate`), i18n, tests.
- Site: `POST /api/reports`, a reports store with retention, tests; `deploy.sh` creates `data/reports`.
- Docs: ADR 0008, `privacy.md` and `using-the-app.md` in three languages.
