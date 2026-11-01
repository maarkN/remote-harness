## ADDED Requirements

### Requirement: tmux server config
The config SHALL accept `tmuxSocket` (a non-empty tmux server name for `tmux -L`, default `remote-harness`, or `null` for the user's default server) and `tmuxConfig` (`minimal` or `user`, default `minimal`), next to `tmuxSession`; both keys are optional in the file. An empty name or another mode MUST be refused with an error naming the key.

#### Scenario: Defaults
- **WHEN** `config.json` has neither key
- **THEN** the daemon uses the server `remote-harness` with the minimal config

#### Scenario: User's own tmux config
- **WHEN** `config.json` has `"tmuxConfig": "user"`
- **THEN** the generated tmux config sources the user's own `tmux.conf` after Remote Harness's settings

#### Scenario: Invalid value
- **WHEN** `config.json` has `"tmuxSocket": ""`
- **THEN** the daemon refuses to start with a message naming `tmuxSocket`
