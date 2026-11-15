## MODIFIED Requirements

### Requirement: Gemini profiles
A profile with `agent: "gemini"` SHALL run Google's Gemini CLI: its `configDir` is a Gemini config folder named `.gemini` (`~/.gemini` by default), and its launcher opens `gemini` in the shared tmux session with `GEMINI_CLI_HOME` set to the folder's parent (unset for `~/.gemini`) and without any provider setup. Resuming runs `gemini --resume <id>`. A Gemini profile whose `configDir` is not named `.gemini` MUST be ignored at start with a warning. The app MUST NOT offer a worktree or a name at start for Gemini sessions, and the daemon MUST answer `bad_request` when asked for a worktree. `gemini` MUST be a reserved profile alias.

#### Scenario: Launcher
- **WHEN** `remote-harness install` runs with a Gemini profile `gem-work` whose `configDir` is `~/work/.gemini`
- **THEN** `~/.remote-harness/bin/gem-work` exports `GEMINI_CLI_HOME=~/work` and opens `gemini` in a new tmux window

#### Scenario: Default folder
- **WHEN** the Gemini profile's `configDir` is `~/.gemini`
- **THEN** the launcher runs `gemini` with `GEMINI_CLI_HOME` unset

#### Scenario: Resume
- **WHEN** the app resumes Gemini session `3f2a9c1e-…`
- **THEN** the launcher runs `gemini --resume 3f2a9c1e-…` in the session's folder

#### Scenario: Folder not named .gemini
- **WHEN** a profile declares `agent: "gemini"` with `configDir` `~/gemini-work`
- **THEN** the profile is left out with a warning and the other profiles load
