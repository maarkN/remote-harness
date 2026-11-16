## MODIFIED Requirements

### Requirement: Session options menu
Tapping the session title in the header, the More options button (⋮) or the folder in the row below the header SHALL open the same **session sheet**: a summary of the session on top (agent badge, title, profile, folder, state) with a close button, the session's actions as a grid of icon buttons with a short label under each, the session details (see "Session details"), and "Close session" set apart at the bottom in the danger color. The grid SHALL hold "View terminal", "Run command…" when the computer accepts shell commands, "Change model…" when the session's profile has a provider, "Subagents (N)" / "Subagents (N · M running)" when the session has subagents, the keyboard shortcuts toggle, the hands-free toggle when the app can speak, "Prompt templates…", "Schedule a prompt…" when the computer keeps schedules, "Conversation history", "Review changes", the follow-output toggle and the live status toggle when the computer can follow, in that order. Each cell SHALL be a button whose accessible label is the full action ("Hide keyboard shortcuts", "Stop following output"); a toggle's cell SHALL be highlighted while it is on, and the Subagents cell SHALL show an accent dot while any subagent runs. Choosing a cell SHALL close the sheet and run the action. "Change model…" SHALL open the model picker and send `/model <id>` to the session as a prompt delivered now. "Prompt templates…" SHALL open the templates picker, whose pick is appended to the prompt draft. In a read-only session, "View terminal", "Change model…", the shortcuts toggle, hands-free, "Prompt templates…", "Schedule a prompt…" and "Close session" MUST be disabled and the sheet MUST say why; "Conversation history", "Review changes", the follow toggle and "Subagents" stay enabled. The More options button SHALL show an accent dot while any subagent runs. On tablets the sheet SHALL be centered and at most 560 pt wide. Icons come from the app's icon set and colors from the theme. All labels MUST be translated.

#### Scenario: Open the terminal
- **WHEN** the user picks "Terminal" in the sheet of a controllable session
- **THEN** the sheet closes and the raw terminal screen of the session opens

#### Scenario: Same sheet from the title and from More options
- **WHEN** the user taps the session title, closes the sheet and taps the More options button
- **THEN** both open the same sheet, with the summary, the action grid, the details and "Close session"

#### Scenario: Change the model
- **WHEN** the user picks "Model" in a controllable OpenRouter session and chooses `anthropic/claude-opus-5.5`
- **THEN** the session receives `/model anthropic/claude-opus-5.5`

#### Scenario: Insert a template
- **WHEN** the user picks "Templates" in a controllable session and chooses a template
- **THEN** the template's filled text is appended to the composer and nothing is sent

#### Scenario: Read-only session
- **WHEN** the user opens the sheet of a session without a tmux pane
- **THEN** "Terminal", the key bar toggle, "Templates" and "Close session" are disabled, the follow toggle is enabled, and the sheet explains that the session is read-only

#### Scenario: Toggle following
- **WHEN** following is on and the user picks "Follow" (announced "Stop following output")
- **THEN** following turns off, and the next time the sheet opens the cell is no longer highlighted and is announced "Follow output"

### Requirement: Session details
The session sheet (see "Session options menu"), opened by tapping the session title in the header, the folder in the row below it or the More options button, SHALL show a "Session details" section after the actions. The title MUST be exposed as a button with a localized accessibility label. The section SHALL list the full folder path, the git branch and worktree root when the folder is in git, the profile name, alias and config dir, the state, the permission mode, whether the session is controllable or read-only, the tmux pane when there is one, the session id, the command that resumes the session on the computer and the last update. The resume command SHALL be `cd <folder> && <alias> <resume arguments>`: the session's full folder (single-quoted when it has characters a shell would read, a quote inside it escaped), the alias of the session's profile, and the resume arguments of the session's agent from the shared protocol table (`--resume <id>` for Claude Code, Gemini CLI and Qwen Code, `resume <id>` for Codex, `--session <id>` for Kimi CLI), the same ones the daemon runs to resume it. Values MUST wrap instead of being cut and MUST be selectable. The folder, the worktree root, the session id and the resume command SHALL have a Copy action that puts the full value on the clipboard. The sheet MUST scroll when a drag starts anywhere on its content (labels, values, gaps between rows), and the sheet itself MUST NOT capture the touch. The sheet MUST close with its close button, by tapping outside, with Esc and with the Android back button; a tap inside it MUST NOT close it. All texts MUST be translated.

#### Scenario: Long folder
- **WHEN** the user taps the title of a session whose folder is longer than the screen width
- **THEN** the sheet shows the full path wrapped over several lines

#### Scenario: Copy the folder
- **WHEN** the user taps Copy on the folder row
- **THEN** the full path is on the clipboard and the row briefly shows "Copied"

#### Scenario: Resume on the computer
- **WHEN** the user opens the details of a Claude Code session of the profile `work` in `/Users/me/repo/.claude/worktrees/fix-login` with id `abc`
- **THEN** a "Resume on the computer" row reads `cd /Users/me/repo/.claude/worktrees/fix-login && work --resume abc`, and its Copy action puts that command on the clipboard

#### Scenario: Folder with spaces
- **WHEN** the session's folder is `/Users/me/My Projects/app` and its agent is Codex, profile `cdx`
- **THEN** the command reads `cd '/Users/me/My Projects/app' && cdx resume <id>`

#### Scenario: Read-only session
- **WHEN** the session has no tmux pane
- **THEN** the sheet shows the access as read-only and has no pane row

#### Scenario: Android back
- **WHEN** the sheet is open on Android and the user presses back
- **THEN** the sheet closes and the session screen stays open

#### Scenario: Drag from a label
- **WHEN** the rows overflow the sheet and the user drags starting on a row's label, value or the gap between rows
- **THEN** the list scrolls

#### Scenario: Tap inside vs. outside
- **WHEN** the user taps inside the sheet outside any button
- **THEN** the sheet stays open; tapping the dimmed area above it closes it
