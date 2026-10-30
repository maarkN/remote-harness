## MODIFIED Requirements

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

## ADDED Requirements

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
