## MODIFIED Requirements

### Requirement: Report a problem
Settings SHALL open a "Report a problem" screen with a description field, attachments, an option to include the computer's recent rejected requests (when the daemon supports `diagnostics.errors`), an option, off by default, to include the computer's logs (when the daemon supports `diagnostics.logs`, shown in full before sending), a preview of the report, and actions to send it, share it (a file on iOS, text on Android) or open a prefilled GitHub issue. Attachments SHALL be images and videos from the library or the camera, a screenshot taken by "Shake to report" and one audio note recorded on the screen (record, stop, play, remove), each listed with a remove action, within 25 MB in total: an attachment that would pass the limit MUST be refused with a message. The screen MUST say, next to Send, that attachments may show what is on the screen. Send SHALL upload the report as one zip (`report.json`, `computer-logs.txt` when included, and the attachments) to `https://remoteharness.app/api/reports` and, once accepted, show the report ID, which the GitHub issue link then includes; a failed upload SHALL say so and keep everything for another try. Send MUST be hidden with the "Never" preference. All texts MUST be translated.

#### Scenario: Share without Firebase
- **WHEN** the build has no Firebase and the user taps Share
- **THEN** the share sheet opens with the report

#### Scenario: Send with attachments
- **WHEN** the user describes the problem, adds a photo and an audio note, turns on the computer's logs and taps Send
- **THEN** one zip with `report.json`, `computer-logs.txt`, the photo and the audio is uploaded, the screen shows "Sent · report <ID>", and the GitHub link's body names that ID

#### Scenario: Too large
- **WHEN** the attachments add up to 20 MB and the user picks a 10 MB video
- **THEN** the video is not added and the screen says the report is limited to 25 MB

#### Scenario: Never
- **WHEN** the preference is Never
- **THEN** Send is hidden and Share and the GitHub link remain

## ADDED Requirements

### Requirement: Shake to report
In release builds, while the app is in the foreground and the "Shake to report a problem" setting is on (the default), shaking the phone (three accelerations above 2.3 g within one second) SHALL show a floating "Report a problem" button for 6 seconds, once per 3 seconds at most. Tapping it SHALL hide it, capture the current screen and open "Report a problem" with that screenshot attached. Development builds MUST NOT listen (the shake opens React Native's dev menu there), and neither may a device whose accelerometer is unavailable. The setting SHALL be in Settings next to "Report a problem", which stays the way in without shaking. All texts MUST be translated.

#### Scenario: Shake
- **WHEN** a release build is in the foreground on a conversation and the user shakes the phone
- **THEN** the "Report a problem" button appears; tapping it opens the report screen with a screenshot of the conversation, without the button in it

#### Scenario: Turned off
- **WHEN** the setting is off and the user shakes the phone
- **THEN** nothing appears

#### Scenario: Walking
- **WHEN** the accelerometer reports one peak above 2.3 g
- **THEN** no button appears

### Requirement: Computer logs
The daemon SHALL answer `diagnostics.logs` with the tail of its log files (the last 256 KB of `daemon.log` and the last 32 KB of `daemon.err.log` and `update.log`, each under a header with its name, cut at a line start) after scrubbing them: in JSON log lines the values of keys naming secrets, tokens, keys, passwords, codes, authorization, cookies, prompts, text, input, output, commands or content are replaced by `[redacted]`; in every line emails, bearer and API tokens, IP addresses and runs of 32 or more token characters are replaced by placeholders, and the home folder by `~`. Missing files are skipped. The logs MUST NOT leave the computer except as this reply to the connection that asked, and MUST NOT carry session content or `command.run` input or output (which the daemon never logs).

#### Scenario: Secrets in a log line
- **WHEN** `daemon.log` has a line with `"token":"abc123…"`, an email and `/Users/me/project`
- **THEN** the reply shows `"token":"[redacted]"`, `[email]` and `~/project`

#### Scenario: Large log
- **WHEN** `daemon.log` is 2 MB
- **THEN** only its last 256 KB are sent, starting at a whole line, and the reply says it was cut
