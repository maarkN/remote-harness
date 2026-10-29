# voice-assistants Specification

## Purpose
Lets the phone's voice assistants (Siri and Shortcuts on iOS, Google Assistant on Android) reply to sessions, answer permissions and tell what is waiting, so the app can be used without touching it.

## Requirements

### Requirement: Siri and Shortcuts actions
On iOS 16 and later the app SHALL offer three actions to Siri, the Shortcuts app and Spotlight: **Reply to a session** (a session and a text), **Answer the pending permission** (allow or deny) and **What's waiting**. Each action SHALL have App Shortcuts phrases that include the app name in pt-BR, en-US and es-ES, and every title, parameter name and fixed sentence SHALL exist in the three languages.

#### Scenario: Reply by voice
- **WHEN** the user says "Reply in Remote Harness" and dictates "run the tests again"
- **THEN** the text is sent to the chosen session as a prompt, exactly like the reply field (`mode` auto), and Siri says it was sent to that session's title

#### Scenario: Ask what is waiting
- **WHEN** the user asks Siri what is waiting in Remote Harness
- **THEN** Siri says how many sessions of the active computer wait for the user and how many are running, naming the waiting ones

### Requirement: Running without opening the app
An action SHALL run without bringing the app to the screen when the app is running (in the foreground or suspended in the background). When the app is not running, the action SHALL ask the user to continue in the app (iOS 17 and later) and finish there; on iOS 16 it SHALL say that the app must be opened first. Every action SHALL require the device to be unlocked. An action that cannot reach the computer, or gets no answer within 15 seconds, SHALL say so instead of reporting success.

#### Scenario: App suspended in the background
- **WHEN** the app is suspended and the user replies through Siri
- **THEN** the reply is sent over a short-lived connection to the active computer and the app stays in the background

#### Scenario: App closed
- **WHEN** the app was closed and the user replies through Siri on iOS 17
- **THEN** Siri asks to continue in Remote Harness, the app opens and the reply is sent

#### Scenario: Computer unreachable
- **WHEN** the active computer cannot be reached
- **THEN** Siri says the computer could not be reached and nothing is reported as sent

### Requirement: Session parameter
The session of **Reply to a session** SHALL be chosen from the active computer's sessions that the app saw last, by title. When the user does not name one, the action SHALL use the most recent session waiting for the user, else the most recently updated session that is not ended. Read-only sessions SHALL NOT be offered, and replying to one SHALL say it cannot receive prompts.

#### Scenario: No session named
- **WHEN** two sessions exist, one waiting for the user and one running, and the user replies without naming a session
- **THEN** the reply goes to the waiting session

### Requirement: Permission answers by voice
**Answer the pending permission** SHALL pick the oldest request of the active computer that is a plain permission (not a question, a plan or a request handed over to the terminal), SHALL read what it asks for (the same title the app shows) and SHALL ask for confirmation before sending allow or deny. With no such request, it SHALL say so; with only questions or plans waiting, it SHALL say they must be answered in the app.

#### Scenario: Deny by voice
- **WHEN** a Bash command waits for permission and the user says "deny" to Siri and confirms
- **THEN** `permission.respond` with `deny` is sent for that request and Siri confirms it

#### Scenario: Only a question waiting
- **WHEN** the only pending request is an interactive question
- **THEN** nothing is answered and Siri says to answer it in the app

### Requirement: Assistant privacy
Session titles SHALL stay on the device: the session list for Siri SHALL be stored only in the app's local storage and SHALL hold only id, title, state and update time of the active computer's sessions. Nothing about sessions SHALL be sent anywhere except the computer, and push payloads SHALL NOT change.

#### Scenario: Forgetting the computer
- **WHEN** the user forgets the active computer or switches to another one
- **THEN** the session list offered to Siri is replaced by the new computer's sessions (or emptied)
