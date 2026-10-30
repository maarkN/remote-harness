## Purpose

Lets the user follow and drive a session without looking at or touching the phone: the app reads the session aloud and answers short voice commands, with confirmations so a misheard word never sends anything.

## ADDED Requirements

### Requirement: Hands-free mode
A controllable session's menu SHALL offer **Hands-free** when the app binary supports speech output. While it is on, the session screen SHALL replace the message composer with a large, high-contrast bar showing the current state (listening, speaking, waiting for the agent) and three controls: **Talk**, **Repeat** and **Exit**; the screen SHALL stay awake. Leaving the session screen, the session ending or Exit SHALL turn it off and stop any speech.

#### Scenario: Turning it on
- **WHEN** the user picks Hands-free in the session menu
- **THEN** the composer is replaced by the hands-free bar and the app says hands-free is on and how to use Talk

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
