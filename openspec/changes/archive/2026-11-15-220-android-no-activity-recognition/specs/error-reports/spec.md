## MODIFIED Requirements

### Requirement: Shake to report
In release builds, while the app is in the foreground and the "Shake to report a problem" setting is on (the default), shaking the phone (three accelerations above 2.3 g within one second) SHALL show a floating "Report a problem" button for 6 seconds, once per 3 seconds at most. Tapping it SHALL hide it, capture the current screen and open "Report a problem" with that screenshot attached. Development builds MUST NOT listen (the shake opens React Native's dev menu there), and neither may a device whose accelerometer is unavailable. The shake SHALL be read from the accelerometer only, which needs no permission; the Android app MUST NOT declare `android.permission.ACTIVITY_RECOGNITION`, which the sensors library declares for its pedometer. The setting SHALL be in Settings next to "Report a problem", which stays the way in without shaking. All texts MUST be translated.

#### Scenario: Shake
- **WHEN** a release build is in the foreground on a conversation and the user shakes the phone
- **THEN** the "Report a problem" button appears; tapping it opens the report screen with a screenshot of the conversation, without the button in it

#### Scenario: Turned off
- **WHEN** the setting is off and the user shakes the phone
- **THEN** nothing appears

#### Scenario: Walking
- **WHEN** the accelerometer reports one peak above 2.3 g
- **THEN** no button appears

#### Scenario: No activity recognition permission
- **WHEN** the Android release bundle is built
- **THEN** its merged manifest does not ask for `android.permission.ACTIVITY_RECOGNITION`, and the app asks for no permission to detect the shake
