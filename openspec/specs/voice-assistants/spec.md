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
Session titles SHALL stay on the device: the session list for the assistants SHALL be stored only in the app's local storage and in the device's launcher shortcuts, and SHALL hold only id, title, state and update time of the active computer's sessions. Nothing about sessions SHALL be sent anywhere except the computer, and push payloads SHALL NOT change.

#### Scenario: Forgetting the computer
- **WHEN** the user forgets the active computer or switches to another one
- **THEN** the session list offered to Siri and the launcher shortcuts are replaced by the new computer's sessions (or emptied)

### Requirement: Google Assistant actions
On Android the app SHALL declare App Actions for Google Assistant: sending a message to a session (the built-in "create message" intent, with the text and optionally the session title), allowing or denying the pending permission, and checking what is waiting, with query patterns in en-US, pt-BR and es-ES. Each action SHALL open the app on an assistant link and act on the active computer, also when an alternate app icon is active; when the app is not paired, the link SHALL lead to pairing as any other link does. Because any app or web page can open these links, an assistant link SHALL NOT send a message or answer a permission without the user confirming it on the screen.

#### Scenario: Message with text
- **WHEN** the user says "Send a message on Remote Harness saying run the tests again"
- **THEN** the app opens showing the text and the session waiting for the user (else the most recent live one); after the user taps Send it is sent exactly like the reply field, "Sent to …" is shown and announced, and then that session is shown

#### Scenario: Link from a web page
- **WHEN** a web page opens `remoteharness://assistant/reply?text=…`
- **THEN** nothing is sent unless the user taps Send on the confirmation screen

#### Scenario: Message without text
- **WHEN** the assistant opens the reply action without a text
- **THEN** the chosen session opens with the message field focused

#### Scenario: Session by title
- **WHEN** the action names a session title that matches one of the active computer's live sessions (ignoring case)
- **THEN** the confirmation names that session; when none matches, the app says it found no such session and sends nothing

### Requirement: Confirming permissions from the assistant
The allow and deny actions SHALL show the oldest plain permission request (the same title the app shows) with the chosen answer highlighted, and SHALL send it only after the user confirms on that screen. Questions, plans and requests handed over to the terminal SHALL NOT be answered there; the screen SHALL say to answer them in the session.

#### Scenario: Deny from the assistant
- **WHEN** a Bash command waits for permission and the user says "Deny the permission on Remote Harness" and taps Deny on the screen
- **THEN** `permission.respond` with `deny` is sent for that request and the screen confirms it

### Requirement: Launcher shortcuts
On Android the app SHALL publish dynamic launcher shortcuts for up to four of the active computer's live sessions (waiting first, then the most recent), each opening that session's reply with the message field focused, and SHALL remove them when the list is emptied.

#### Scenario: Long press on the icon
- **WHEN** the user long-presses the app icon while two sessions are live
- **THEN** both sessions appear as shortcuts named by their titles, and choosing one opens it ready to type
