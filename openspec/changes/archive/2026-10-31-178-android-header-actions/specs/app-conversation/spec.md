## MODIFIED Requirements

### Requirement: Context line
Under the header, the session screen SHALL show a first context line with the agent badge, the profile tag (name in the profile color), the folder (truncating; opens the session details), the state pill and the permission mode chip. The header itself SHALL show, after the title, the notifications bell, a terminal button (disabled in read-only sessions) and the More options button, on iOS and on Android alike (the tablet layout adds its inspector button); on iOS they are native bar items with the shared background turned off, elsewhere they fill the header's classic right slot.

#### Scenario: Live session
- **WHEN** a controllable Claude Code session in `~/projects/acme-api` is open
- **THEN** the context line shows the Claude Code badge, the profile tag, `~/projects/acme-api`, the state pill and the mode chip, and the header's terminal button opens the raw terminal

#### Scenario: Read-only session
- **WHEN** the session has no tmux pane
- **THEN** the terminal button is disabled and the mode chip is dimmed

#### Scenario: Android header
- **WHEN** a session is open on an Android phone
- **THEN** the header shows the bell, the terminal button and the More options button on the right, as on iOS
