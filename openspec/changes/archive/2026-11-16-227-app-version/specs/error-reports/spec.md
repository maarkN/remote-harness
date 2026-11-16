## MODIFIED Requirements

### Requirement: Report a problem
Settings SHALL open a "Report a problem" screen with a description field, attachments, an option to include the computer's recent rejected requests and the last app build it saw from each paired device, by ID and platform, without names (when the daemon supports `diagnostics.errors`), an option, off by default, to include the computer's logs (when the daemon supports `diagnostics.logs`, shown in full before sending), a preview of the report, and actions to send it, share it (a file on iOS, text on Android) or open a prefilled GitHub issue. Attachments SHALL be images and videos from the library or the camera, a screenshot taken by "Shake to report" and one audio note recorded on the screen (record, stop, play, remove), each listed with a remove action, within 25 MB in total: an attachment that would pass the limit MUST be refused with a message. The screen MUST say, next to Send, that attachments may show what is on the screen. Send SHALL upload the report as one zip (`report.json`, `computer-logs.txt` when included, and the attachments) to `https://remoteharness.app/api/reports` and, once accepted, show the report ID, which the GitHub issue link then includes; a failed upload SHALL say so and keep everything for another try. Send MUST be hidden with the "Never" preference. All texts MUST be translated.

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

#### Scenario: Which build the computer saw
- **WHEN** the user includes the computer's errors in a report and the computer answers with its devices
- **THEN** the report's `daemon` block lists each device's ID, platform, last seen and app version, and no device name
