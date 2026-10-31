## ADDED Requirements

### Requirement: Kimi profiles
A profile with `agent: "kimi"` SHALL run Moonshot's Kimi CLI: its `configDir` is the Kimi data dir (`KIMI_SHARE_DIR`, `~/.kimi` by default), and its launcher opens `kimi` in the shared tmux session with `KIMI_SHARE_DIR` set (unset for `~/.kimi`) and without any provider setup. Resuming runs `kimi --session <id>`. The app MUST NOT offer a worktree or a name at start for Kimi sessions, and the daemon MUST answer `bad_request` when asked for a worktree. `kimi` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Kimi profile `km-work` whose `configDir` is `~/.kimi-work`
- **THEN** `~/.claude-remote/bin/km-work` exports `KIMI_SHARE_DIR=~/.kimi-work` and opens `kimi` in a new tmux window

#### Scenario: Resume
- **WHEN** the app resumes Kimi session `5d1c…`
- **THEN** the launcher runs `kimi --session 5d1c…` in the session's folder

### Requirement: Kimi sessions in the list
The daemon SHALL list Kimi sessions whose `wire.jsonl` was modified within `recentDays` (`<configDir>/sessions/<md5 of the folder>/<session id>/wire.jsonl`) as read-only sessions with the profile's agent, the folder from the `kimi.json` work dir whose md5 names the parent folder, and a title from `state.json`'s `custom_title`, else the first prompt, else the folder name. Kimi hooks carry no transcript path: the daemon SHALL derive it from the profile's data dir, the hook's `cwd` and `session_id`. Kimi hook events SHALL create and update sessions like Claude Code's: `SessionStart` links the session to its tmux pane (controllable), `UserPromptSubmit` sets `running` (and the title when it is still the folder name), `Stop` and `StopFailure` set `idle` and push "done", `SessionEnd` ends it.

#### Scenario: Recent session
- **WHEN** `~/.kimi/kimi.json` lists the work dir `/Users/a/api`, `~/.kimi/sessions/<md5 of /Users/a/api>/5d1c…/wire.jsonl` was written today and its first prompt is "run the tests"
- **THEN** the list has session `5d1c…`, agent `kimi`, folder `/Users/a/api`, title "run the tests", read-only

#### Scenario: Transcript path from the hook
- **WHEN** a `SessionStart` hook of profile `km` (`~/.kimi`) arrives with `session_id` `5d1c…` and `cwd` `/Users/a/api`
- **THEN** the session's transcript is `~/.kimi/sessions/<md5 of /Users/a/api>/5d1c…/wire.jsonl`

### Requirement: Kimi transcript
The conversation of a Kimi session SHALL be read from its `wire.jsonl` as normalized entries: prompts and mid-turn messages (with data-URL images), replies, thinking, tool calls with their results, interruptions and compactions. `Shell`, `ReadFile`, `WriteFile`, `StrReplaceFile`, `Grep`, `Glob`, `SearchWeb` and `FetchURL` SHALL become `exec`, `Read`, `Write`, `Edit`, `Grep`, `Glob`, `WebSearch` and `WebFetch` with the input fields the app renders; other tools keep their name and arguments. A tool result with `is_error` is marked as an error. Only the Kimi format module MAY know the wire format; the metadata line and unknown lines MUST NOT break the stream.

#### Scenario: Shell call
- **WHEN** a session file has `TurnBegin` "run the tests", a `ToolCall` `Shell` with `{"command":"pnpm test"}`, its `ToolResult` with output "ok", and a `ContentPart` text "All tests pass."
- **THEN** the app shows the prompt, `exec(pnpm test)` with result "ok" and the reply

#### Scenario: Interrupted turn
- **WHEN** a session file has a `StepInterrupted` line
- **THEN** the app shows the turn as interrupted

### Requirement: Kimi hooks installation
For Kimi profiles, `install` and `setup` SHALL add to `<configDir>/config.toml` one `[[hooks]]` table per event (`SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionEnd`) whose command posts the event JSON to the daemon (`StopFailure` as `Stop`) with the hook secret, the tmux pane and the profile, discarding the output, with timeouts in seconds; read → merge → backup → atomic write, idempotent, keeping every other line of the file as it is, and removed by `uninstall` or when the profile leaves the config. The daemon's tables SHALL be recognized by their command, since Kimi rewrites the file without comments. A `config.toml` that declares `hooks` as a key instead of tables MUST NOT be changed, and doctor SHALL report its hooks as missing. Doctor SHALL report whether the hooks are installed and whether `kimi` is on the PATH, also when no Kimi profile exists but `~/.kimi` does (then pointing at `remote-harness setup`).

#### Scenario: Idempotent install
- **WHEN** `remote-harness install` runs twice for a Kimi profile whose `config.toml` has `default_model`, a `[models.kimi]` table and a user `[[hooks]]` table
- **THEN** the file keeps those lines unchanged, has one Remote Harness table per event at the end, and the second run changes nothing

#### Scenario: Rewritten by Kimi
- **WHEN** Kimi saves its settings and rewrites `config.toml`, and `remote-harness install` runs again
- **THEN** the daemon's tables are recognized and not added twice

### Requirement: Kimi approvals from the app
While a controllable Kimi session is `running` or `waiting`, the daemon SHALL check its pane every second for Kimi's approval panel. When a panel appears and the session has no open request, the daemon SHALL set the session to `waiting` and open a permission request for the phone with Allow and Deny only (`rules: false`, no suggested rule), naming the tool call the session file shows without a result (else the tool the panel names). Allow SHALL press `1` ("Approve once") and Deny SHALL press `3` ("Reject") in the pane, only while the same panel is on screen; otherwise the answer fails with `already_resolved` and the request is resolved. A panel that disappears, or is replaced by a different one, without an answer from the phone SHALL resolve the request as answered in the terminal (and a different panel opens a new request). "Approve for this session" MUST NOT be offered, and nothing MAY switch the session to yolo or afk.

#### Scenario: Allow from the phone
- **WHEN** Kimi shows its approval panel for `Shell` `pnpm test` in pane `%3` and the user taps Allow
- **THEN** the daemon finds the same panel in `%3`, presses `1` and the request resolves as allowed

#### Scenario: Answered in the terminal
- **WHEN** a request is open for a Kimi panel and the user presses `1` in the terminal
- **THEN** on the next check the panel is gone and the request resolves as answered in the terminal

### Requirement: Kimi input and commands
Prompts SHALL be pasted into a Kimi pane as one bracketed paste and submitted with Enter at least 100 ms later; with the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Kimi slash commands SHALL be offered for Kimi sessions, with menus marked interactive and without `/yolo` or `/afk`.

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Kimi session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 100 ms later

### Requirement: Kimi setup detection
`remote-harness setup` SHALL offer `~/.kimi` as an account when it holds `config.toml`, `kimi.json` or `sessions`, suggesting a Kimi profile (`agent: kimi`, alias `km`, name `Kimi`, the Kimi color).

#### Scenario: Detected
- **WHEN** setup runs on a machine with `~/.claude` and `~/.kimi/config.toml`
- **THEN** the account list shows `~/.claude` and `~/.kimi`, the latter as `Kimi · km`
