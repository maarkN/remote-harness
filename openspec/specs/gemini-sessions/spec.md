# gemini-sessions Specification

## Purpose
Follow and control Google Gemini CLI sessions like Claude Code ones: profiles, launch and resume, session files, hooks, approvals typed into Gemini's own dialog, input and setup.

## Requirements

### Requirement: Gemini profiles
A profile with `agent: "gemini"` SHALL run Google's Gemini CLI: its `configDir` is a Gemini config folder named `.gemini` (`~/.gemini` by default), and its launcher opens `gemini` in the shared tmux session with `GEMINI_CLI_HOME` set to the folder's parent (unset for `~/.gemini`) and without any provider setup. Resuming runs `gemini --resume <id>`. A Gemini profile whose `configDir` is not named `.gemini` MUST be ignored at start with a warning. The app MUST NOT offer a worktree or a name at start for Gemini sessions, and the daemon MUST answer `bad_request` when asked for a worktree. `gemini` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Gemini profile `gem-work` whose `configDir` is `~/work/.gemini`
- **THEN** `~/.claude-remote/bin/gem-work` exports `GEMINI_CLI_HOME=~/work` and opens `gemini` in a new tmux window

#### Scenario: Default folder
- **WHEN** the Gemini profile's `configDir` is `~/.gemini`
- **THEN** the launcher runs `gemini` with `GEMINI_CLI_HOME` unset

#### Scenario: Resume
- **WHEN** the app resumes Gemini session `3f2a9c1e-…`
- **THEN** the launcher runs `gemini --resume 3f2a9c1e-…` in the session's folder

#### Scenario: Folder not named .gemini
- **WHEN** a profile declares `agent: "gemini"` with `configDir` `~/gemini-work`
- **THEN** the profile is left out with a warning and the other profiles load

### Requirement: Gemini sessions in the list
The daemon SHALL list Gemini session files modified within `recentDays` (`<configDir>/tmp/<project>/chats/session-*.jsonl`, the session id read from the file's first line) as read-only sessions with the profile's agent, the folder from `tmp/<project>/.project_root`, and a title from the first prompt, else the folder name. Gemini hooks SHALL create and update sessions like Claude Code's: `SessionStart` links the session to its tmux pane (controllable), `BeforeAgent` sets `running` (and the title when it is still the folder name), the approval dialog notice sets `waiting`, `AfterAgent` sets `idle` and pushes "done", `SessionEnd` ends it.

#### Scenario: Recent session file
- **WHEN** `~/.gemini/tmp/api/chats/session-2026-10-31T09-12-3f2a9c1e.jsonl` starts with header `{"sessionId":"3f2a9c1e-…"}`, `tmp/api/.project_root` holds `/Users/a/api` and the first prompt is "run the tests"
- **THEN** the list has session `3f2a9c1e-…`, agent `gemini`, folder `/Users/a/api`, title "run the tests", read-only

#### Scenario: Live session
- **WHEN** a Gemini session launched by a profile launcher starts in tmux pane `%7`
- **THEN** its `SessionStart` hook makes it controllable on pane `%7`

#### Scenario: Turn ends
- **WHEN** the `AfterAgent` hook of a running Gemini session arrives
- **THEN** the session becomes `idle` and the "done" push is sent

### Requirement: Gemini transcript
The conversation of a Gemini session SHALL be read from its session file as normalized entries: prompts, replies, thoughts (subject and description), tool calls with their results, and `info`, `warning` and `error` lines as system entries. A message that Gemini appends again with the same id (when it gains tool calls or token counts) MUST NOT show twice: each entry is taken from the first line that holds it, and later copies add only new tool calls. Shell commands SHALL become `exec` (`command`, `workdir`), and `read_file`, `write_file`, `replace`, `grep_search`, `glob` and `google_web_search` SHALL become `Read`, `Write`, `Edit`, `Grep`, `Glob` and `WebSearch` with the input fields the app renders; other tools keep their name and arguments. A tool result with status `error` or `cancelled`, or an `error` response, is marked as an error. Only the Gemini format module MAY know the session file format; header, `$set`, `$rewindTo`, `$patch` and unknown lines MUST NOT break the stream.

#### Scenario: Message appended again
- **WHEN** a session file holds the reply "Running the tests." with id `g1`, then the same `g1` again with a completed `run_shell_command` call `pnpm test` (output "ok"), then `g1` again with token counts
- **THEN** the app shows the reply once, `exec(pnpm test)` once with result "ok", and nothing else from those lines

#### Scenario: Failed tool
- **WHEN** a `replace` call has status `error`
- **THEN** it shows as `Edit` on its file, with the result marked as an error

### Requirement: Gemini hooks installation
For Gemini profiles, `install` and `setup` SHALL merge command hooks into `<configDir>/settings.json` for `SessionStart`, `BeforeAgent`, `AfterAgent`, `Notification` and `SessionEnd`, each posting the event JSON to the daemon (as `SessionStart`, `UserPromptSubmit`, `Stop`, `PermissionDialog` and `SessionEnd`) with the hook secret, the tmux pane and the profile, discarding the output, with timeouts in milliseconds; read → merge → backup → atomic write, idempotent, never touching the user's own hooks or other settings, and removed by `uninstall` or when the profile leaves the config. Setup and doctor MUST tell the user that Gemini runs no hooks in a folder it does not trust, so a session started there stays read-only until the folder is trusted. Doctor SHALL report whether the hooks are installed and whether `gemini` is on the PATH, also when no Gemini profile exists but `~/.gemini` does (then pointing at `remote-harness setup`).

#### Scenario: Idempotent install
- **WHEN** `remote-harness install` runs twice for a Gemini profile whose `settings.json` has a user hook and a theme
- **THEN** the file keeps the user hook and the theme, has one Remote Harness group per Gemini event, and the second run changes nothing

#### Scenario: Prompt hook
- **WHEN** Gemini runs the installed `BeforeAgent` hook
- **THEN** the daemon receives it as `UserPromptSubmit` with the prompt

### Requirement: Gemini approvals from the app
When a Gemini session is about to show its tool approval dialog (the `Notification` hook with `notification_type` `ToolPermission`), the daemon SHALL open a permission request for the phone with Allow and Deny only (`rules: false`, no suggested rule), built from the dialog details (`exec` with the command, `Edit` with the file and its old and new content, `mcp__<server>__<tool>` for MCP tools), and SHALL answer the hook at once so Gemini shows its dialog. Allow SHALL press `1` ("Allow once") and Deny SHALL press Escape in the session's pane, only after checking that the dialog is on screen; without the dialog the answer fails with `already_resolved` and the request is resolved. A request answered in the terminal, expired or left behind by the session SHALL be resolved like a Claude Code one. Allow for the session or for future sessions MUST NOT be offered, and nothing MAY switch the session to yolo.

#### Scenario: Allow from the phone
- **WHEN** Gemini asks to run `pnpm test` in pane `%7` and the user taps Allow
- **THEN** the daemon finds the dialog in `%7`, presses `1` and the request resolves as allowed

#### Scenario: Deny from the phone
- **WHEN** the user taps Deny on a Gemini request whose dialog is on screen
- **THEN** the daemon presses Escape in the pane and the request resolves as denied

#### Scenario: Dialog already gone
- **WHEN** the user taps Allow after the dialog was answered in the terminal and before the transcript shows it
- **THEN** no key is pressed and the app is told the request was already resolved

### Requirement: Gemini input and commands
Prompts SHALL be pasted into a Gemini pane as one bracketed paste and submitted with Enter at least 250 ms later; with the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Gemini slash commands SHALL be offered for Gemini sessions, with menus (`/model`, `/resume`, `/settings`, …) marked interactive.

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Gemini session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 250 ms later

### Requirement: Gemini setup detection
`remote-harness setup` SHALL offer `~/.gemini` as an account when it holds `settings.json`, `oauth_creds.json`, `projects.json` or `tmp`, suggesting a Gemini profile (`agent: gemini`, alias `gem`, name `Gemini`, the Gemini color).

#### Scenario: Detected
- **WHEN** setup runs on a machine with `~/.claude` and `~/.gemini/oauth_creds.json`
- **THEN** the account list shows `~/.claude` and `~/.gemini`, the latter as `Gemini · gem`
