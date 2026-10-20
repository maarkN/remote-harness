## MODIFIED Requirements

### Requirement: Codex sessions in the list
The daemon SHALL list Codex rollouts modified within `recentDays` (`<CODEX_HOME>/sessions/YYYY/MM/DD/rollout-*-<uuid>.jsonl`, the uuid being the session id) as read-only sessions with the profile's agent, the rollout's `cwd`, a title from the thread name in `session_index.jsonl`, else the first prompt, else the folder name, and the latest approval policy. Codex hook events SHALL create and update sessions like Claude Code's: `SessionStart` links the session to its tmux pane (controllable), `UserPromptSubmit` sets `running` (and the title when it is still the folder name), `PermissionRequest` sets `waiting`, `Stop` sets `idle` and pushes "done", `Interrupt` also sets `idle` (a turn paused instead of finishing, e.g. to ask the user a question, so the session is ready for the next prompt the same as after `Stop`), `SessionEnd` ends it.

#### Scenario: Recent rollout
- **WHEN** `~/.codex/sessions/2026/10/19/rollout-2026-10-19T14-37-08-0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f.jsonl` was written today with the first prompt "run the tests"
- **THEN** the list has session `0199fd2a-7c1e-7a33-9a0e-5b0f2c1d4e6f`, agent `codex`, title "run the tests", read-only

#### Scenario: Live session
- **WHEN** a Codex session launched by a profile launcher starts in tmux pane `%7`
- **THEN** its `SessionStart` hook makes it controllable on pane `%7`

#### Scenario: Turn paused instead of finishing
- **WHEN** a `running` Codex session's `Interrupt` hook arrives
- **THEN** the session becomes `idle`, the same as a `Stop`

### Requirement: Codex hooks installation
For Codex profiles, `install` and `setup` SHALL merge command hooks for `SessionStart`, `UserPromptSubmit`, `PermissionRequest`, `Stop`, `Interrupt` and `SessionEnd` into `<CODEX_HOME>/hooks.json`, posting the event to the daemon with the hook secret, the tmux pane and the profile; read → merge → backup → atomic write, idempotent, never touching the user's own hooks, and removed by `uninstall` or when the profile leaves the config. Setup and doctor MUST tell the user that Codex asks to trust new hooks once ("Hooks need review" → trust), and doctor SHALL report whether the hooks are installed and whether `codex` is on the PATH. The PATH check SHALL also run when no Codex profile is configured yet but a `~/.codex` (or `~/.codex-*`) directory holding `config.toml`, `auth.json` or `sessions` is found; in that case doctor SHALL additionally report that a Codex account was found without a profile and point at `remote-harness setup`. With neither a Codex profile nor such a directory, the Codex checks are skipped, as before.

#### Scenario: Idempotent install
- **WHEN** `remote-harness install` runs twice for a Codex profile whose `hooks.json` has a user hook
- **THEN** the file has the user hook and one Remote Harness group per event, and the second run changes nothing

#### Scenario: PATH checked without a configured profile
- **WHEN** `doctor` runs on a machine with no Codex profile, a `~/.codex` directory with `config.toml`, and `codex` not on the PATH
- **THEN** it still reports the `codex` PATH check as failed, instead of skipping it

#### Scenario: No Codex signal at all
- **WHEN** `doctor` runs on a machine with no Codex profile and no `~/.codex`-like directory
- **THEN** the Codex PATH and hooks checks are skipped, as before

#### Scenario: Account found without a profile
- **WHEN** `doctor` runs on a machine with `~/.codex/config.toml` and no profile uses it
- **THEN** it reports a Codex account was found without a profile and points at `remote-harness setup`
