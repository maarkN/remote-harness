## ADDED Requirements

### Requirement: In-app offline demo
The app SHALL offer an offline demo that needs no computer: a fictional computer that lives only in the app's memory, reached through the app's normal connection code with an in-memory socket instead of the network. The demo daemon SHALL answer the WebSocket protocol with messages that pass the same `@remote-harness/protocol` validation as a real daemon's, after a Noise handshake with keys generated for that run only. The demo MUST NOT open any network connection for its data, MUST NOT save its computer or keys, and MUST NOT change the paired computers.

Every main screen SHALL work in the demo with fictional data: the session list with sessions waiting for a permission, running, idle and ended (read-only); a conversation with thinking, text, tool calls and their results; answering the waiting permission request (allowing or denying it moves the session on with a fictional result); the raw terminal with the agent's prompt box and its mode line, which follows mode changes made in the app; subagents with their own transcripts; the session's changes and diffs; Settings (machine, paired devices, profiles, rules, approval log, computer permissions, daemon update). A prompt sent in the demo SHALL appear in the conversation and get a short fictional reply. A request the demo does not simulate (for example starting or resuming a session, attachments, shell commands, commit and push, adding a device) SHALL fail with a localized "not available in the demo" message instead of hanging.

#### Scenario: Open the demo
- **WHEN** the user taps **Try the demo** on the pairing screen with the phone in airplane mode
- **THEN** the session list shows the fictional sessions, one of them waiting for a permission

#### Scenario: Approve in the demo
- **WHEN** the user allows the waiting request in the demo
- **THEN** the request disappears, the session shows the tool's fictional result and becomes idle

#### Scenario: Terminal mode line
- **WHEN** the user switches a demo session to plan mode and opens its terminal
- **THEN** the terminal shows the plan mode line

#### Scenario: Unsupported action
- **WHEN** the user tries to start a new session in the demo
- **THEN** the app says that it is not available in the demo

### Requirement: Demo banner and exit
While the demo runs, the session list, the conversation and the terminal SHALL show a banner saying it is a demo, with an action to leave it, and Settings SHALL show a Demo card with the same action in place of the Computers card, without the Machine card's Forget and rename actions. Leaving SHALL close the demo connection and return to the pairing screen, and MUST clear every piece of demo state the app holds: its sessions, transcripts, pending requests, drafts, pinned and hidden sessions. Leaving MUST NOT remove or change any paired computer. Pairing a real computer while in the demo SHALL end the demo the same way. The demo SHALL not survive an app restart: the app starts on the pairing screen again.

#### Scenario: Leave the demo
- **WHEN** the user taps **Leave demo** on the banner
- **THEN** the pairing screen appears, and opening the demo again shows its initial state without the drafts typed before

#### Scenario: Restart during the demo
- **WHEN** the app is killed while in the demo and opened again
- **THEN** the pairing screen appears

### Requirement: Demo stays off the services
While the demo runs, the app MUST NOT register for push (no notification permission prompt, no token sent), MUST NOT start or register Live Activities or the Android live status, MUST NOT send error reports, and MUST NOT send performance data, whatever the user's settings say; the Settings cards for notifications, error reports and performance numbers SHALL be hidden. The user's own settings SHALL be the same after leaving the demo.

#### Scenario: Push stays off
- **WHEN** the user opens the demo on a fresh install
- **THEN** no notification permission prompt appears and no push token is requested

#### Scenario: Performance data on
- **WHEN** "Send performance data" is on and the user opens the demo
- **THEN** no trace is sent while the demo runs, and the setting is still on after leaving

### Requirement: Shared demo fixtures
The fictional profiles, repositories, sessions (with their transcripts, permission request, status lines, subagents) and the terminal text of each session SHALL be defined once, in a module without Node APIs that both the daemon's screenshot demo and the in-app demo read, so screenshots and the in-app demo show the same data. Every name, path, host, prompt and output in it MUST be fictional.

#### Scenario: Same sessions
- **WHEN** the developer runs the daemon demo and also opens the in-app demo
- **THEN** both list the same sessions with the same titles and states
