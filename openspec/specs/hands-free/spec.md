# hands-free Specification

## Purpose
Lets the user follow and drive a session without looking at or touching the phone: the app reads the session aloud and answers short voice commands, with confirmations so a misheard word never sends anything.

## Requirements

### Requirement: Hands-free mode
A controllable session's menu SHALL offer **Hands-free** when the app binary supports speech output. While it is on, the session screen SHALL replace the message composer with a large, high-contrast bar showing the current state (listening, speaking, waiting for the agent) and three controls: **Talk**, **Repeat** and **Exit**; the screen SHALL stay awake while hands-free is on. Hands-free SHALL stay on when the user leaves the session screen, locks the phone or puts the app in the background, and coming back to the session SHALL show the bar again. It SHALL be on for one session at a time: turning it on for another session turns it off for the previous one. Exit, the voice command "stop", the lock-screen control, the session ending (or no longer taking input) and the idle timeout SHALL turn it off and stop any speech.

#### Scenario: Turning it on
- **WHEN** the user picks Hands-free in the session menu
- **THEN** the composer is replaced by the hands-free bar and the app says hands-free is on and how to use Talk

#### Scenario: Leaving the screen
- **WHEN** hands-free is on and the user goes back to the session list
- **THEN** it stays on, the next finished turn of that session is still read aloud, and opening the session shows the bar

#### Scenario: Another session
- **WHEN** hands-free is on for session A and the user turns it on for session B
- **THEN** session A's hands-free stops and only session B is read aloud

### Requirement: Reading the session aloud
While hands-free is on, the app SHALL speak, in the app language: the last assistant answer of each finished turn (markdown, code blocks and links reduced to plain words, cut at a sentence after about 500 characters with a note that the rest is in the app); each plain permission request of the session (its title, then "Say allow or deny"); and each question with its options numbered. A plan, or a request handed over to the terminal, SHALL be announced as needing the screen. Nothing older than the moment hands-free was turned on SHALL be read, and a new item SHALL wait until the current speech ends.

#### Scenario: Turn finished
- **WHEN** the agent finishes a turn whose last answer is "Done. The tests pass."
- **THEN** the app speaks "Done. The tests pass."

#### Scenario: Question
- **WHEN** the agent asks "Which database?" with options "Postgres" and "SQLite"
- **THEN** the app speaks the question, "Option 1, Postgres. Option 2, SQLite." and how to answer

### Requirement: Voice commands
After speaking a permission, a question or a message to confirm, and whenever Talk is pressed, the app SHALL listen once (up to about 8 seconds, in the transcription language) and understand, in pt-BR, en-US and es-ES: allow, deny, yes, no, repeat, stop, option numbers (digits or words, several for a multiple-choice question) and anything else as a message. Allow, deny and options SHALL be sent at once, like the matching taps, and confirmed aloud ("Allowed.", "Answered."). A message SHALL be read back ("Send: … ? Say yes or no.") and sent only after "yes"; "no" or silence SHALL discard it. "Stop" SHALL turn hands-free off; "repeat" SHALL speak the last item again. A command that does not fit the current item SHALL be answered with a short hint and nothing SHALL be sent.

#### Scenario: Deny by voice
- **WHEN** a permission was read aloud and the user says "deny"
- **THEN** `permission.respond` with `deny` is sent for that request and the app says "Denied."

#### Scenario: Message needs a yes
- **WHEN** the user presses Talk and says "run the tests again"
- **THEN** the app says "Send: run the tests again? Say yes or no." and sends it as a prompt only if the next answer is "yes"

#### Scenario: Misheard option
- **WHEN** a question has two options and the user says "option five"
- **THEN** nothing is answered and the app says which options exist

### Requirement: Feedback without the screen
The app SHALL mark with haptics when it starts listening, when it stops, and when something was sent or answered, so the state is clear without looking.

#### Scenario: Listening cue
- **WHEN** the app starts listening after a prompt
- **THEN** the phone gives a short haptic tap

### Requirement: Hands-free in the background
On app binaries that include the background support, hands-free SHALL keep working with the screen locked or the app in the background: finished turns, permission requests and questions of the session SHALL be read aloud as they happen, the app SHALL listen for the answer after each one, and the answer SHALL be sent exactly as in the foreground. The connection to the computer SHALL stay open while the mode is on. While hands-free is on, the app SHALL count as in the foreground for the computer's push rules, so no push is sent for what it reads aloud. On iOS the app SHALL use the audio background mode with a spoken-audio session that ducks other audio and gives the microphone back after each listening; on Android a foreground service SHALL keep the app alive. Binaries without the background support SHALL behave as before once the app is suspended.

#### Scenario: Permission with the screen locked
- **WHEN** hands-free is on, the phone is locked and the session asks a permission
- **THEN** the phone speaks the permission, listens, and "allow" sends `permission.respond` with `allow`

#### Scenario: Turn finished in the background
- **WHEN** hands-free is on, another app is in front and the agent finishes a turn
- **THEN** the last answer is spoken and no push notification for that turn arrives on this phone

#### Scenario: Older binary
- **WHEN** the binary has no background support and the phone is locked
- **THEN** nothing is spoken until the app is in front again, and the computer's pushes arrive as usual

### Requirement: Lock-screen control
While hands-free is on, the phone SHALL show a system control outside the app that names the session and can turn hands-free off without unlocking: on iOS a Now Playing card ("Hands-free is on", the session title) on the lock screen and Control Center whose pause or stop control turns it off, with the headset play/pause button acting as Talk; on Android a persistent notification ("Hands-free is on", the session title) with a **Stop** action, which opens the session when tapped. The control SHALL disappear when hands-free turns off. Texts MUST be translated.

#### Scenario: Stop from the lock screen (iOS)
- **WHEN** hands-free is on and the user taps pause on the lock screen's Now Playing card
- **THEN** hands-free turns off, speech stops and the card disappears

#### Scenario: Stop from the notification (Android)
- **WHEN** hands-free is on and the user taps Stop on its notification
- **THEN** hands-free turns off, speech stops and the notification is removed

#### Scenario: Headset button
- **WHEN** hands-free is on and the user presses play/pause on a headset
- **THEN** the app starts listening, as if Talk were pressed

### Requirement: Background guard rails
While the app is in the background with hands-free on, the app SHALL NOT read aloud a session that is muted (itself or its profile); its requests stay for the screen. After 30 minutes without anything read, heard or changed in the session, the app SHALL say that hands-free turned off for inactivity and turn it off (also releasing the lock-screen control and the background keep-alive). In the foreground neither rule applies.

#### Scenario: Muted session in the background
- **WHEN** hands-free is on for a muted session and the phone is locked
- **THEN** a finished turn is not spoken

#### Scenario: Idle timeout
- **WHEN** hands-free is on in the background and nothing happens for 30 minutes
- **THEN** the app says hands-free turned off after 30 minutes without activity and the Now Playing card or notification goes away
