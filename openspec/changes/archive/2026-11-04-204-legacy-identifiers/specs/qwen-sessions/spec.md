## MODIFIED Requirements

### Requirement: Qwen profiles
A profile with `agent: "qwen"` SHALL run Qwen Code: its `configDir` is the Qwen config dir (`QWEN_HOME`, `~/.qwen` by default), and its launcher opens `qwen` in the shared tmux session with `QWEN_HOME` set (unset for `~/.qwen`) and without any provider setup. Resuming runs `qwen --resume <id>`. The app MUST NOT offer a worktree or a name at start for Qwen sessions, and the daemon MUST answer `bad_request` when asked for a worktree. `qwen` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Qwen profile `qw-work` whose `configDir` is `~/.qwen-work`
- **THEN** `~/.remote-harness/bin/qw-work` exports `QWEN_HOME=~/.qwen-work` and opens `qwen` in a new tmux window

#### Scenario: Resume
- **WHEN** the app resumes Qwen session `8b0e…`
- **THEN** the launcher runs `qwen --resume 8b0e…` in the session's folder
