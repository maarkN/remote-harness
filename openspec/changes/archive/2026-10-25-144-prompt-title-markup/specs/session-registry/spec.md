## ADDED Requirements

### Requirement: Prompt-derived title
A Claude Code session's title SHALL be, in order: the latest name given with `/rename` (or from the app), else its first prompt, else its last prompt, else the folder name. While the title is still the folder name, or is raw markup left by older daemons, each prompt SHALL set it. A title taken from a prompt MUST NOT show markup: harness context (system reminders, command output) is ignored; text pasted into the prompt is replaced by the user's own words around it, or by the first line of the pasted text when there are none; a slash command gives the command and its arguments. A plain prompt SHALL win over a slash command as the first prompt. A prompt with nothing left SHALL leave the title as it was.

#### Scenario: Pasted prompt with the user's words
- **WHEN** the first prompt is "Summarize this" followed by a pasted block
- **THEN** the session is titled "Summarize this"

#### Scenario: Only pasted text
- **WHEN** the first prompt is only a pasted block whose first line is "Error: connection refused"
- **THEN** the session is titled "Error: connection refused"

#### Scenario: Slash command
- **WHEN** the first prompt is the `/review` command with the argument `123`
- **THEN** the session is titled "/review 123"

#### Scenario: Raw tag from an older daemon
- **WHEN** a session is titled with a raw `<pasted_content …>` tag and the user sends another prompt
- **THEN** the title is replaced by the title of that prompt

#### Scenario: Name wins
- **WHEN** a session was renamed with `/rename` and the user pastes a prompt
- **THEN** the session keeps its name
