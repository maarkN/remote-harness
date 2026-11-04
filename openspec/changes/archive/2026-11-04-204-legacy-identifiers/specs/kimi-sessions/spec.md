## MODIFIED Requirements

### Requirement: Kimi profiles
A profile with `agent: "kimi"` SHALL run Moonshot's Kimi CLI: its `configDir` is the Kimi data dir (`KIMI_SHARE_DIR`, `~/.kimi` by default), and its launcher opens `kimi` in the shared tmux session with `KIMI_SHARE_DIR` set (unset for `~/.kimi`) and without any provider setup. Resuming runs `kimi --session <id>`. The app MUST NOT offer a worktree or a name at start for Kimi sessions, and the daemon MUST answer `bad_request` when asked for a worktree. `kimi` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Kimi profile `km-work` whose `configDir` is `~/.kimi-work`
- **THEN** `~/.remote-harness/bin/km-work` exports `KIMI_SHARE_DIR=~/.kimi-work` and opens `kimi` in a new tmux window

#### Scenario: Resume
- **WHEN** the app resumes Kimi session `5d1c…`
- **THEN** the launcher runs `kimi --session 5d1c…` in the session's folder
