## MODIFIED Requirements

### Requirement: Prompt-derived title
A Claude Code session's title SHALL be, in order: the latest name given with `/rename` (or from the app), else its first prompt, else its last prompt, else the folder name. The same order SHALL hold while the session runs, from the hooks, as when its transcript is read: a title only gives way to one from a stronger source, so a plain prompt replaces a title taken from a slash command or shell line (`/clear`, `!ls`, with or without the transcript's markup), a name replaces any prompt title, and the first prompt or command of its kind stays. While the title is still the folder name, or is raw markup left by older daemons, each prompt SHALL set it. A title taken from a prompt MUST NOT show markup: harness context (system reminders, command output) is ignored; text pasted into the prompt is replaced by the user's own words around it, or by the first line of the pasted text when there are none; a slash command gives the command and its arguments. A prompt with nothing left SHALL leave the title as it was. A name written to the transcript (`/rename`, `--name`) SHALL reach the app without resuming: from the `/rename` prompt itself, from the transcript while it is followed, or from its backlog when a conversation is opened.

#### Scenario: Pasted prompt with the user's words
- **WHEN** the first prompt is "Summarize this" followed by a pasted block
- **THEN** the session is titled "Summarize this"

#### Scenario: Only pasted text
- **WHEN** the first prompt is only a pasted block whose first line is "Error: connection refused"
- **THEN** the session is titled "Error: connection refused"

#### Scenario: Slash command
- **WHEN** the first prompt is the `/review` command with the argument `123`
- **THEN** the session is titled "/review 123"

#### Scenario: Plain prompt after a command, while the session runs
- **WHEN** a session started on the computer gets `/clear`, then `/model opus`, then "fix the tests" as prompts
- **THEN** its title goes from the folder name to "/clear" and then to "fix the tests", where a later prompt leaves it

#### Scenario: Rename while the session runs
- **WHEN** the user types `/rename Login bug` in the terminal of a session titled "fix the tests"
- **THEN** the app shows "Login bug" without resuming, and later prompts keep it

#### Scenario: Raw tag from an older daemon
- **WHEN** a session is titled with a raw `<pasted_content …>` tag and the user sends another prompt
- **THEN** the title is replaced by the title of that prompt

#### Scenario: Name wins
- **WHEN** a session was renamed with `/rename` and the user pastes a prompt
- **THEN** the session keeps its name
