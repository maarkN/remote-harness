## Context

"Report a problem" (`features/error-reports/`) builds a `Report` (description, scrubbed device log, the daemon's rejected requests) and sends it through Crashlytics, shares it or opens a prefilled GitHub issue. The site (`apps/web`) is a Node server in Docker behind Traefik with a data folder; it serves updates and install links and had no upload endpoint. The daemon logs with pino to `~/.remote-harness/logs/`.

## Goals / Non-Goals

**Goals:** report a problem from anywhere in the app with a shake; attach what shows the problem (screen, media, a voice note, the computer's logs); get it to the maintainer.

**Non-Goals:** a place to read reports in the browser; sending reports automatically; Codex/other-agent logs; changing crash reporting (Crashlytics stays for crashes).

## Decisions

- **Upload to the site, not the share sheet** (the user's choice). One zip per report, posted to `/api/reports`, kept for 30 days, with no read or list endpoint: the maintainer copies them from the server. The alternative, a zip in the share sheet, needs no server but loses reports in whatever app the user picks. Recorded in ADR 0008.
- **No end-to-end sealing of the zip.** The site's server is run by the maintainer, who is the reader; sealing to a public key would add key management (a private key to keep, a decrypt tool) for one reader. Exposure is bounded instead: HTTPS only, no HTTP read path, 30-day retention, explicit consent per report.
- **What is collected and when.** Nothing leaves the phone until the user taps Send on a screen that shows the report, every attachment (removable) and, when included, the computer's logs. Attachments are the user's own choice and may show session content (a screenshot of a conversation): the screen says so next to Send. The device log keeps its scrubbing; the computer's logs are opt-in, off by default, and scrubbed by the daemon before they leave the computer.
- **Send respects "Never".** The existing preference already hides Send with Never; the upload takes that place, so a user who said Never keeps Share and the GitHub link only.
- **Abuse limits.** Anyone can post to a public endpoint: each report is at most 25 MB and must be a zip, an address gets 5 uploads an hour, and the reports folder stops taking uploads at 2 GB (507) until the sweep frees space.
- **Zip on the phone with fflate (pure JS)** and upload with `expo-file-system`'s binary upload: no multipart parser on the server, one file per report. Media is stored, not recompressed.
- **Shake from the accelerometer** (`expo-sensors`): three peaks above 2.3 g within a second, then a 3-second pause; release builds only (a shake opens the dev menu in development builds) and only while the app is in the foreground. The screenshot is `react-native-view-shot`'s `captureScreen`, taken after the button is hidden.
- **Logs scrubbed by the daemon**, by key (values of keys naming secrets, tokens, keys, codes, prompts, text, input, output or commands) and by pattern (emails, bearer and API tokens, IPs, long token-like runs, the home folder), from the last 256 KB of `daemon.log` and 32 KB of the other two.

## Risks / Trade-offs

- A screenshot or video can show session content → shown before sending, removable, and the screen says it; retention 30 days.
- The shake can fire while walking → it only shows a button for a few seconds; the switch turns it off.
- New native modules → shipped with the next store build; the fingerprint runtime keeps the OTA bundle that needs them off older binaries.
