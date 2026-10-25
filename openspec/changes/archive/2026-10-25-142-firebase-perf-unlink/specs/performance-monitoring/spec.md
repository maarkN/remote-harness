## MODIFIED Requirements

### Requirement: Opt-in performance data
In builds with Firebase, the app SHALL include Firebase Performance Monitoring with collection off until the user turns on "Send performance data" in Settings → Error reports. The choice SHALL be saved per device and applied at every start. The switch MUST NOT be shown in builds without Firebase. A platform without its Google services file (`GoogleService-Info.plist` on iOS, `google-services.json` on Android) SHALL build without any React Native Firebase native module, Performance Monitoring included. Android builds MUST NOT apply the Gradle plugin that instruments network requests. Traces MUST NOT carry session content, prompts, paths, project or session names, or the daemon's address, and the app MUST NOT send Analytics events.

#### Scenario: Default
- **WHEN** the app is installed and started
- **THEN** no performance data is sent

#### Scenario: Turned on
- **WHEN** the user turns on "Send performance data"
- **THEN** Firebase collects the automatic traces and the app's custom traces from then on

#### Scenario: Android build without Firebase
- **WHEN** an Android release build runs without `google-services.json`
- **THEN** it builds and links no React Native Firebase module, `@react-native-firebase/perf` included

#### Scenario: iOS pods without Firebase
- **WHEN** `pod install` runs without `GoogleService-Info.plist`
- **THEN** it succeeds without any React Native Firebase pod
