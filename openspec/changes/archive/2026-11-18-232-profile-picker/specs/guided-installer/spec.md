## MODIFIED Requirements

### Requirement: Profile wizard
`remote-harness setup` SHALL show the logo, detect the Claude Code configuration directories, let the user choose the profiles and set the alias and name of each, and only write after confirmation. The alias MUST be valid, unique and different from `claude`, `claude-remote` and `rhnss` (the profile picker). At the end of an interactive run, before the closing summary, the wizard SHALL ask whether to add the profile picker command `rhnss` (see the launchers' "Profile picker"), defaulting to the current `profilePicker` setting, save the answer to `config.json` and write or remove the command at once; the closing summary SHALL mention `rhnss` when it is on. A non-interactive run (`--yes`) SHALL keep the current setting.

#### Scenario: Two accounts
- **WHEN** `~/.claude` and `~/.claude-work` exist and the user chooses the aliases `personal` and `work`
- **THEN** `config.json` now has both profiles and the `personal` and `work` commands open each account's Claude Code in tmux

#### Scenario: New account
- **WHEN** the user chooses "Create a new account" and enters the folder (suggested `~/.claude-trabalho`)
- **THEN** the wizard creates the folder, opens Claude Code with `CLAUDE_CONFIG_DIR` pointing to it for login, checks the login when the user returns (`oauthAccount` or `primaryApiKey` in `.claude.json`) and adds the account to the list; without a login, it offers to open it again, add it anyway or discard it

#### Scenario: No accounts found
- **WHEN** no configuration directory exists and the wizard is interactive
- **THEN** it offers to create a new account instead of exiting

#### Scenario: Another tool's directory
- **WHEN** `~/.claude-mem` (claude-mem plugin) exists, or a `~/.claude-*` without `settings.json`, `.claude.json`, `.credentials.json` or `projects/`
- **THEN** it is not offered as an account

#### Scenario: Invalid alias
- **WHEN** the user types `claude` as the alias
- **THEN** the wizard rejects it and asks for another

#### Scenario: Profile removed
- **WHEN** a configured profile is unselected
- **THEN** its launcher and hooks are removed

#### Scenario: Profile picker offered at the end
- **WHEN** the user finishes an interactive `remote-harness setup` and answers yes to adding the `rhnss` command
- **THEN** `config.json` has `profilePicker: true`, `~/.remote-harness/bin/rhnss` exists and the closing summary mentions `rhnss`; answering no later removes the command and sets `profilePicker` to `false`
