## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Assistant privacy
Session titles SHALL stay on the device: the session list for the assistants SHALL be stored only in the app's local storage and in the device's launcher shortcuts, and SHALL hold only id, title, state and update time of the active computer's sessions. Nothing about sessions SHALL be sent anywhere except the computer, and push payloads SHALL NOT change.

#### Scenario: Forgetting the computer
- **WHEN** the user forgets the active computer or switches to another one
- **THEN** the session list offered to Siri and the launcher shortcuts are replaced by the new computer's sessions (or emptied)
