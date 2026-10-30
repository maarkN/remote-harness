## MODIFIED Requirements

### Requirement: Codex profiles
A profile with `agent: "codex"` SHALL run OpenAI Codex CLI: its `configDir` is the Codex home (`CODEX_HOME`, `~/.codex` by default), its launcher opens `codex` in the shared tmux session with `CODEX_HOME` set (unset for `~/.codex`) and without any provider setup, resuming runs `codex resume <id>`, and starting in a worktree runs `codex --worktree` (Codex creates and names the worktree itself, under its own home). The daemon MUST keep Codex profiles (they have an adapter) and Claude Code profiles MUST behave as before. `codex` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Codex profile `cdx` whose `configDir` is `~/.codex-work`
- **THEN** `~/.claude-remote/bin/cdx` exports `CODEX_HOME=~/.codex-work` and opens `codex` in a new tmux window

#### Scenario: Resume
- **WHEN** the app resumes Codex session `0199fd2a-…`
- **THEN** the launcher runs `codex resume 0199fd2a-…` in the session's folder

#### Scenario: Worktree
- **WHEN** the app starts a Codex session with the worktree option in a git checkout
- **THEN** the launcher runs `codex --worktree` in that folder

#### Scenario: No worktree
- **WHEN** the app starts a Codex session with the worktree option in a folder that is not a git checkout
- **THEN** the daemon answers `bad_request`

### Requirement: Codex input
Prompts SHALL be pasted into a Codex pane as one bracketed paste and submitted with Enter at least 250 ms later, so Codex does not take the Enter as part of the paste. With the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Codex slash commands SHALL be offered for Codex sessions, with `/model`, `/permissions`, `/resume` and the other menus marked interactive. Changing the permission mode of a Codex session follows "Codex permissions from the app".

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Codex session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 250 ms later

### Requirement: Codex permission requests
A Codex `PermissionRequest` hook SHALL be held open and offered on the phone like Claude Code's, with Allow and Deny only: no suggested rule, `rules: false` on the request, and the answer MUST never carry rules or a mode change (Codex treats either as a failed hook). Allow answers that request only. When the phone does not answer in time the hook MUST return no decision, so Codex shows its own prompt in the terminal.

#### Scenario: Allow from the phone
- **WHEN** Codex asks to run `rm -rf build` and the user taps Allow
- **THEN** the hook answers `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}`

#### Scenario: No Always
- **WHEN** a Codex permission request reaches the app
- **THEN** it has no suggested rule, `rules` is `false`, and the Always action is not offered

#### Scenario: Always sent anyway
- **WHEN** a client answers a Codex request with `always { rule, scope }`
- **THEN** the daemon answers `bad_request`, writes no rule and the request stays open

## ADDED Requirements

### Requirement: Codex permissions from the app
The daemon SHALL read a Codex session's permission profile from its rollout, next to the approval policy: the `active_permission_profile.id` of the latest `turn_context` or `thread_settings_applied` line, else the latest `turn_context` sandbox policy (`read-only` → `:read-only`, `workspace-write` → `:workspace`, `danger-full-access` → `:danger-full-access`), and send it on `Session.permissionProfile`; unknown stays `null`. `session.setMode` on a controllable Codex session SHALL accept the presets `read-only` and `workspace` and switch by submitting `/permissions :read-only` or `/permissions :workspace` into the pane, answering `ack` with the requested profile; the session's `permissionProfile` changes only when Codex records the change in its rollout. Any other value, including `full-access`, `:danger-full-access` and `bypassPermissions`, MUST be refused with `mode_forbidden` (an unknown value with `bad_request`), and nothing is typed. While a permission request of the session is pending the daemon MUST answer `session_busy`. Switching requires Codex 0.164 or later; older versions leave the profile unchanged.

#### Scenario: Read profile
- **WHEN** a Codex rollout's latest `turn_context` has `sandbox_policy` `{ "type": "workspace-write" }` and no `active_permission_profile`
- **THEN** the session's `permissionProfile` is `:workspace`

#### Scenario: Switch to read only
- **WHEN** the app sends `session.setMode { mode: "read-only" }` for an idle Codex session in pane `%7`
- **THEN** the daemon submits `/permissions :read-only` in `%7` and answers `ack`

#### Scenario: Full access refused
- **WHEN** the app sends `session.setMode { mode: "full-access" }` for a Codex session
- **THEN** the daemon answers `mode_forbidden` and types nothing

#### Scenario: Claude Code mode on Codex
- **WHEN** the app sends `session.setMode { mode: "plan" }` for a Codex session
- **THEN** the daemon answers `bad_request`

### Requirement: Codex session name
When a Codex session started with a name registers against its pane, the daemon SHALL submit `/rename <name>` into the pane once, so Codex stores the name as the thread name (`session_index.jsonl`) and the title survives a daemon restart. Codex fires `SessionStart` with the first turn, so the name is sent when that hook links the session.

#### Scenario: Named Codex session
- **WHEN** a Codex session started with name "Login bug" registers on pane `%9`
- **THEN** the daemon submits `/rename Login bug` in `%9` once and the session's title is "Login bug"

### Requirement: Codex one-shot call
Codex profiles without a model provider SHALL support the one-shot call used by Polish dictation and generated messages: `codex exec --json --ephemeral --skip-git-repo-check --ignore-user-config --sandbox read-only -c model_reasoning_effort="low"` with the instructions and the text as the prompt (extra material on standard input), run outside any project directory with the profile's `CODEX_HOME`. The answer is the text of the last `agent_message` item in the JSON lines output; none (or a failed run) is no answer. No session file is written, so the call never shows up as a session.

#### Scenario: Polish through Codex
- **WHEN** Polish dictation runs for a Codex session and `codex exec` prints an `item.completed` line with an `agent_message` "Continue the tests."
- **THEN** the polished text is "Continue the tests."

#### Scenario: No agent message
- **WHEN** the `codex exec` output has no `agent_message` item
- **THEN** the call has no answer and the original text is used
