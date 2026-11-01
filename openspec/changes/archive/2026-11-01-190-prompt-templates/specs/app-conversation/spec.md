## MODIFIED Requirements

### Requirement: Session options menu
The session header SHALL have a "More options" button that opens a menu with "View terminal", "Change model…" when the session's profile has a provider, "Subagents (N)" / "Subagents (N · M running)" when the session has subagents, "Show keyboard shortcuts" / "Hide keyboard shortcuts", "Prompt templates…", "Conversation history", "Stop following output" / "Follow output" and "Close session". "Change model…" SHALL open the model picker and send `/model <id>` to the session as a prompt delivered now. "Prompt templates…" SHALL open the templates picker, whose pick is appended to the prompt draft. The menu MUST be native on iOS and look like the platform overflow menu on Android. In a read-only session, "View terminal", "Change model…", the shortcuts toggle, "Prompt templates…" and "Close session" MUST be disabled and the menu MUST say why; "Conversation history", the follow toggle and "Subagents" stay enabled. The button SHALL show an accent dot while any subagent runs. All labels MUST be translated.

#### Scenario: Open the terminal
- **WHEN** the user picks "View terminal" in a controllable session
- **THEN** the raw terminal screen of the session opens

#### Scenario: Change the model
- **WHEN** the user picks "Change model…" in a controllable OpenRouter session and chooses `anthropic/claude-opus-5.5`
- **THEN** the session receives `/model anthropic/claude-opus-5.5`

#### Scenario: Insert a template
- **WHEN** the user picks "Prompt templates…" in a controllable session and chooses a template
- **THEN** the template's filled text is appended to the composer and nothing is sent

#### Scenario: Read-only session
- **WHEN** the user opens the menu in a session without a tmux pane
- **THEN** "View terminal", the shortcuts toggle, "Prompt templates…" and "Close session" are disabled, the follow toggle is enabled, and the menu explains that the session is read-only

#### Scenario: Toggle following
- **WHEN** following is on and the user picks "Stop following output"
- **THEN** following turns off and the menu then offers "Follow output"
