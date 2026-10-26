## ADDED Requirements

### Requirement: Rules screen
Settings → Permissions SHALL open a Rules screen listing the computer's always-allow rules from `rules.list`, grouped by file, each group showing its scope (profile or project) and the profile or project it belongs to. App-created rules SHALL have **Undo** (`rules.undo`, no extra confirmation beyond an alert). Hand-written rules SHALL be read-only except for **Delete**, offered only on this screen, which asks for the device's biometrics (or its passcode; only a confirmation alert when the device has no lock at all) before sending `rules.delete`. An older daemon without `rules.list` shows a "not supported" note.

#### Scenario: Undo an app-created rule
- **WHEN** the user taps Undo on `Bash(pnpm test:*)` and confirms
- **THEN** the app sends `rules.undo` with its log ID and the rule leaves the list

#### Scenario: Delete a hand-written rule
- **WHEN** the user taps Delete on a hand-written rule and the biometric check fails or is cancelled
- **THEN** nothing is sent and the rule stays

### Requirement: Activity screen
Settings → Permissions SHALL open an Activity screen with the approval log from `approvals.list`: per entry the action, the device, the session folder, the tool and target (or the rule), and the relative time. An "allowed always" entry whose rule is still an app-created rule SHALL offer Undo there too. An older daemon without `approvals.list` shows a "not supported" note.

#### Scenario: Activity after an allow
- **WHEN** the user allowed `Bash` (`git commit`) from this phone and opens Activity
- **THEN** the first entry shows "Allowed", this device, the folder, `Bash · git commit` and "now"
