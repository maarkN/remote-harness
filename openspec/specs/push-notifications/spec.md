# push-notifications Specification

## Purpose
Alerts the paired device when a session needs attention, without exposing session content to external services.

## Requirements

### Requirement: Device registration
The app SHALL request notification permission, obtain the FCM token and send `device.register`; the daemon MUST store only tokens received over authenticated connections, keep at most one registration per paired device (the latest), and drop the registrations of devices that are revoked or no longer paired. A registration MAY say `turnActions: true`: that app build draws turn pushes itself on Android (see Turn notification actions); the daemon stores the flag with the token.

#### Scenario: Token refreshed
- **WHEN** FCM refreshes the token
- **THEN** the app sends the new token and the daemon replaces that device's old one

#### Scenario: Ten devices
- **WHEN** ten paired devices each register their token
- **THEN** all ten receive pushes

#### Scenario: Revoked device
- **WHEN** a device is revoked
- **THEN** its push registration is removed and it receives no further pushes

### Requirement: Push delivery
The daemon SHALL send a push to the registered tokens when a session finishes a turn (`Stop`), receives `Notification` or produces a permission request, unless a connected client has the app in the foreground. With a Firebase service account file the daemon SHALL send directly to FCM; without one it SHALL send through the push relay with each phone's grant. The config `push: "off"` (also set by `remote-harness push off`) MUST stop every push, live status updates included, and MUST apply to a running daemon without a restart.

#### Scenario: Session finishes
- **WHEN** `Stop` arrives and the app is in the background
- **THEN** the device receives "Session finished" with the profile

#### Scenario: Firebase not configured
- **WHEN** there is no service account and the phone registered with a relay grant
- **THEN** the daemon sends the push through the relay

#### Scenario: Turned off
- **WHEN** the user runs `remote-harness push off`
- **THEN** the running daemon sends no more pushes or live status updates until `remote-harness push on`

### Requirement: Content-free payload
The payload MUST contain only a generic title, the profile name, `sessionId`, the event type and `requestId` when present; never prompts, commands or paths.

#### Scenario: Permission request
- **WHEN** a `Bash` call asks for permission
- **THEN** the push says "Permission pending" and the profile, without the command

### Requirement: Deep link and actions
Every push and the live status link SHALL carry the sending daemon's ID. Tapping the notification SHALL open the session on that computer, switching the active computer first when it is another one; the "Allow"/"Deny" actions MUST answer the request by connecting in the background to that notification's computer. Requests with an `interaction` (question or plan) MUST NOT offer these actions. Permission pushes offer only Allow and Deny; the turn actions are only on turn pushes.

#### Scenario: Deny from the notification
- **WHEN** the user taps "Deny" on the notification
- **THEN** the app sends `permission.respond` with `deny` to the computer that sent it

#### Scenario: Question without actions
- **WHEN** Claude asks a question and the app is in the background
- **THEN** the push has no Allow/Deny actions and tapping it opens the session

#### Scenario: Notification from the other computer
- **WHEN** the desktop is active and the user taps a notification from the laptop
- **THEN** the app switches to the laptop and opens that session

### Requirement: Interactive request title
The push for a request with an `interaction` SHALL use a generic title saying Claude is waiting for an answer (question) or for a plan review (plan), never the question or plan content.

#### Scenario: Plan ready
- **WHEN** `ExitPlanMode` reaches the daemon with the app in the background
- **THEN** the device receives "Plan ready for review" with the profile name

### Requirement: Push visibility and test
The daemon SHALL report its push mode (`firebase`, `relay` or `off`) in `auth.ok`, and `remote-harness doctor` and `remote-harness push status` SHALL print it with the number of registered phones. The app SHALL show, in the Notifications card of Settings, a `Push notifications` toggle for this phone (on by default, kept on the device, with the hint that only this phone is notified and never with the conversation). While it is on, the card SHALL show the daemon's mode, this phone's state (permission, registration, relay grant), what is missing when push cannot work, and a "Send test notification" button. Turning it off SHALL send `device.unregister` with the phone's token, after which the daemon MUST drop that token from its registry, and the app MUST NOT register again (nor on token refresh) until the toggle is on. A test (`push.test`) MUST go only to the requesting phone, even with the app in the foreground, carry no session content, and answer `sent`, `off`, `unregistered` or `failed`. `remote-harness push test` SHALL send a test to every registered phone. All texts MUST be translated.

#### Scenario: Test from the app
- **WHEN** the user taps "Send test notification" with push working
- **THEN** a test notification appears on that phone and the card says it was sent

#### Scenario: Permission denied
- **WHEN** notifications are denied for the app
- **THEN** the card says so and offers to open the system settings

#### Scenario: Build without relay
- **WHEN** the daemon is in relay mode and the app build has no relay
- **THEN** the card says the computer needs a Firebase service account

#### Scenario: Older daemon
- **WHEN** the daemon does not report a push mode
- **THEN** the mode is shown as unknown and the test button is hidden

#### Scenario: Push off on this phone
- **WHEN** the user turns `Push notifications` off
- **THEN** the app sends `device.unregister`, the daemon no longer counts or targets that phone, and the status and test controls are hidden until the toggle is on again

### Requirement: Question reminder push
The reminder for an interactive request SHALL be a push titled "Still waiting for your answer" (question) or "Plan still waiting for review" (plan), with the profile name as the body and the session deep link. It has no content from the session and no Allow/Deny actions, and it follows the same mute and foreground rules as other pushes.

#### Scenario: Reminder on the lock screen
- **WHEN** a question reminder is sent with the app in the background
- **THEN** the phone shows "Still waiting for your answer" with the profile name, and tapping it opens the session

### Requirement: Turn notification actions
The pushes for a finished turn (`Stop`) and for a session waiting for the user (`Notification`) of a controllable session SHALL carry the category `TURN`, or `TURN_QUEUE` when the session has queued prompts; a read-only session's pushes carry none. `TURN` offers **Reply** (a text input action), **Reply by voice** and **Interrupt**; `TURN_QUEUE` adds **Send next queued**. The category is a fixed name: the payload still carries only the generic title, the profile name and identifiers. Every action MUST require the device to be unlocked (iOS `isAuthenticationRequired`; Android: a turn channel with private lock-screen visibility, so the actions only appear unlocked). The answers MUST go from the device to the notification's computer through the background responder (the Noise channel), never through the push relay:

- Reply sends `session.input` with the typed text and `mode: auto`;
- Interrupt sends `session.key` `Escape`;
- Send next queued sends `queue.sendNext`;
- Reply by voice opens the app on that session, starts the recording right away (continuous recording and voice polish as in the composer) and sends the prompt when the recording ends.

An action whose answer fails opens the session instead.

#### Scenario: Reply from the lock screen
- **WHEN** the iPhone is locked and the user picks Reply on "Session finished"
- **THEN** iOS asks to unlock, then the typed text reaches the session as a prompt, and the push relay never sees it

#### Scenario: Queue offered only with queued prompts
- **WHEN** a session finishes with two prompts queued
- **THEN** its push has the `TURN_QUEUE` category with Send next queued, and a session with an empty queue gets `TURN`

#### Scenario: Reply by voice
- **WHEN** the user picks Reply by voice
- **THEN** the app opens that session already recording and sends the prompt when the user finishes

#### Scenario: Permission push unchanged
- **WHEN** a permission request is pushed
- **THEN** it offers only Allow and Deny

### Requirement: Android turn pushes as data messages
For Android devices registered with `turnActions: true`, the daemon SHALL send turn pushes as high-priority data messages (title, body, category and identifiers in `data`, no `notification` block), which the app draws on the turn channel with the category's actions, also when it was in the background or closed. Every other device keeps the notification message (Android without buttons, iOS with the category).

#### Scenario: Old Android build
- **WHEN** an Android device registered without `turnActions` gets a turn push
- **THEN** it receives the usual notification message, drawn by the system without actions
