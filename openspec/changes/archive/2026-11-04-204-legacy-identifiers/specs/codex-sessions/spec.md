## MODIFIED Requirements

### Requirement: Codex profiles
A profile with `agent: "codex"` SHALL run OpenAI Codex CLI: its `configDir` is the Codex home (`CODEX_HOME`, `~/.codex` by default), its launcher opens `codex` in the shared tmux session with `CODEX_HOME` set (unset for `~/.codex`) and without any provider setup, resuming runs `codex resume <id>`, and starting in a worktree runs `codex --worktree` (Codex creates and names the worktree itself, under its own home). The daemon MUST keep Codex profiles (they have an adapter) and Claude Code profiles MUST behave as before. `codex` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Codex profile `cdx` whose `configDir` is `~/.codex-work`
- **THEN** `~/.remote-harness/bin/cdx` exports `CODEX_HOME=~/.codex-work` and opens `codex` in a new tmux window

#### Scenario: Resume
- **WHEN** the app resumes Codex session `0199fd2a-…`
- **THEN** the launcher runs `codex resume 0199fd2a-…` in the session's folder

#### Scenario: Worktree
- **WHEN** the app starts a Codex session with the worktree option in a git checkout
- **THEN** the launcher runs `codex --worktree` in that folder

#### Scenario: No worktree
- **WHEN** the app starts a Codex session with the worktree option in a folder that is not a git checkout
- **THEN** the daemon answers `bad_request`
