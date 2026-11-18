## ADDED Requirements

### Requirement: Profile picker
When `profilePicker` is `true` in `config.json` (default `false`), `install`, `setup` and `update` SHALL write a `rhnss` command next to the launchers (`~/.remote-harness/bin/rhnss`), rewritten together with them, so it always lists the current profiles. The script SHALL be the same zsh as the launchers, executable and generated (it says not to edit it).

Run without arguments, it SHALL:
- list the profiles as numbered rows of agent name, profile name and config folder (`~` for the home folder), in aligned columns;
- ask for a number, and also accept a profile's alias as the answer;
- `exec` that profile's launcher with every argument it got, in the current folder, so the session starts exactly as with the launcher.

An answer that matches no profile SHALL ask again; an empty answer or end of input SHALL exit without starting anything. `rhnss <alias> [args…]` SHALL start that profile without asking, and with a single profile `rhnss` SHALL start it directly. The texts SHALL be in the language of `config.json` when the script is written. With `profilePicker` off, `install`, `setup` and `update` SHALL remove a picker written before, and `uninstall` SHALL remove it as well.

#### Scenario: Picking a profile
- **WHEN** `profilePicker` is on, the profiles are `work` (Claude Code, `~/.claude-work`), `personal` (Claude Code, `~/.claude`) and `cx` (Codex, `~/.codex-x`), and the user runs `rhnss --resume abc` in `~/api` and answers `3`
- **THEN** the three rows are shown with aligned columns and the `cx` launcher runs in `~/api` with `--resume abc`

#### Scenario: Profile named on the command line
- **WHEN** the user runs `rhnss work --continue`
- **THEN** the `work` launcher runs with `--continue` and nothing is asked

#### Scenario: Single profile
- **WHEN** only one profile is configured and the user runs `rhnss`
- **THEN** that profile's launcher runs without a question

#### Scenario: Invalid answer
- **WHEN** the user answers `7` with three profiles
- **THEN** the picker says the answer is not in the list and asks again; an empty answer exits without starting a session

#### Scenario: Profile added later
- **WHEN** a profile is added with `remote-harness setup` (or in `config.json` followed by `remote-harness install`)
- **THEN** `rhnss` lists it, without editing anything by hand

#### Scenario: Turned off and uninstalled
- **WHEN** `profilePicker` is set back to `false` and `remote-harness install` runs, or the user runs `remote-harness uninstall`
- **THEN** `~/.remote-harness/bin/rhnss` no longer exists
