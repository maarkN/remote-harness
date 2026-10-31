## ADDED Requirements

### Requirement: Qwen profiles
A profile with `agent: "qwen"` SHALL run Qwen Code: its `configDir` is the Qwen config dir (`QWEN_HOME`, `~/.qwen` by default), and its launcher opens `qwen` in the shared tmux session with `QWEN_HOME` set (unset for `~/.qwen`) and without any provider setup. Resuming runs `qwen --resume <id>`. The app MUST NOT offer a worktree or a name at start for Qwen sessions, and the daemon MUST answer `bad_request` when asked for a worktree. `qwen` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Qwen profile `qw-work` whose `configDir` is `~/.qwen-work`
- **THEN** `~/.claude-remote/bin/qw-work` exports `QWEN_HOME=~/.qwen-work` and opens `qwen` in a new tmux window

#### Scenario: Resume
- **WHEN** the app resumes Qwen session `8b0e…`
- **THEN** the launcher runs `qwen --resume 8b0e…` in the session's folder

### Requirement: Qwen sessions in the list
The daemon SHALL list Qwen transcripts modified within `recentDays` (`<configDir>/projects/<folder>/chats/<session id>.jsonl`) as read-only sessions with the profile's agent, the folder from the records' `cwd`, and a title from the latest `custom_title` record, else the first prompt typed, else the folder name. Qwen hook events SHALL create and update sessions like Claude Code's: `SessionStart` links the session to its tmux pane (controllable), `UserPromptSubmit` sets `running` (and the title when it is still the folder name), `PermissionRequest` and a waiting `Notification` set `waiting`, `Stop` and `StopFailure` set `idle` and push "done", `SessionEnd` ends it.

#### Scenario: Recent transcript
- **WHEN** `~/.qwen/projects/-Users-a-api/chats/8b0e….jsonl` was written today, its records have `cwd` `/Users/a/api` and the first typed prompt is "run the tests"
- **THEN** the list has session `8b0e…`, agent `qwen`, folder `/Users/a/api`, title "run the tests", read-only

#### Scenario: Renamed
- **WHEN** the transcript has a `custom_title` record "Login bug"
- **THEN** the session's title is "Login bug"

### Requirement: Qwen transcript
The conversation of a Qwen session SHALL be read from its transcript as normalized entries: the prompts the user typed (not injected context), replies, thoughts, tool calls with their results and compactions. Shell commands SHALL become `exec`, and `read_file`, `write_file`, `edit`, `grep_search`, `glob` and `web_search` SHALL become `Read`, `Write`, `Edit`, `Grep`, `Glob` and `WebSearch` with the input fields the app renders; other tools keep their name and arguments. A result with an `error` response or status `error` or `cancelled` is marked as an error. Only the Qwen format module MAY know the transcript format; unknown records MUST NOT break the stream.

#### Scenario: Shell call
- **WHEN** a transcript has the typed prompt "run the tests", an assistant `functionCall` `run_shell_command` `{"command":"pnpm test"}`, its `tool_result` with output "ok" and the reply "All tests pass."
- **THEN** the app shows the prompt, `exec(pnpm test)` with result "ok" and the reply

#### Scenario: Injected context
- **WHEN** a `user` record has `provenance` other than `real_user`
- **THEN** it does not show as a prompt

### Requirement: Qwen hooks installation
For Qwen profiles, `install` and `setup` SHALL merge command hooks into `<configDir>/settings.json` for `SessionStart`, `UserPromptSubmit`, `PermissionRequest`, `Notification`, `Stop`, `StopFailure` (posted as `Stop`) and `SessionEnd`, posting the event JSON to the daemon with the hook secret, the tmux pane and the profile; the permission hook prints the daemon's answer and the others discard their output, with timeouts in seconds; read → merge → backup → atomic write, idempotent, never touching the user's own hooks or other settings, and removed by `uninstall` or when the profile leaves the config. Doctor SHALL report whether the hooks are installed and whether `qwen` is on the PATH, also when no Qwen profile exists but `~/.qwen` does (then pointing at `remote-harness setup`).

#### Scenario: Idempotent install
- **WHEN** `remote-harness install` runs twice for a Qwen profile whose `settings.json` has a user hook and a model setting
- **THEN** the file keeps both, has one Remote Harness group per event, and the second run changes nothing

### Requirement: Qwen permission requests
A Qwen `PermissionRequest` hook SHALL be held open and offered on the phone with Allow and Deny only (`rules: false`, no suggested rule), and the answer MUST carry neither rules nor a mode change. When the phone does not answer in time the hook MUST return no decision, so Qwen shows its own dialog in the terminal. Nothing MAY switch the session to `auto` or `yolo`.

#### Scenario: Allow from the phone
- **WHEN** Qwen asks to run `pnpm test` and the user taps Allow
- **THEN** the hook answers `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}`

### Requirement: Qwen input and commands
Prompts SHALL be pasted into a Qwen pane as one bracketed paste and submitted with Enter at least 250 ms later; with the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Qwen slash commands SHALL be offered for Qwen sessions, with menus marked interactive and without commands that change the approval mode.

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Qwen session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 250 ms later

### Requirement: Qwen setup detection
`remote-harness setup` SHALL offer `~/.qwen` as an account when it holds `settings.json`, `installation_id`, `oauth_creds.json` or `projects`, suggesting a Qwen profile (`agent: qwen`, alias `qw`, name `Qwen Code`, the Qwen color).

#### Scenario: Detected
- **WHEN** setup runs on a machine with `~/.claude` and `~/.qwen/settings.json`
- **THEN** the account list shows `~/.claude` and `~/.qwen`, the latter as `Qwen Code · qw`
