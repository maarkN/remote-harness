## ADDED Requirements

### Requirement: App identifier
The app SHALL use `com.alvyntech.remoteharness` as its iOS bundle identifier and its Android package, on both stores and in the builds made from the repository. The daemon's service label, the URL schemes, the notification channel and the data directory MUST NOT change with it. The docs SHALL tell users that builds with the former id (`tech.doctorx.clauderemote`) are a separate app that the new one does not replace.

#### Scenario: Build configuration
- **WHEN** the Expo config is resolved for iOS or Android
- **THEN** the bundle identifier and the package are `com.alvyntech.remoteharness`

#### Scenario: Phone with an older build
- **WHEN** a user with a `tech.doctorx.clauderemote` build installs the new one
- **THEN** both apps exist side by side and the troubleshooting page tells them to pair the new one and delete the old
