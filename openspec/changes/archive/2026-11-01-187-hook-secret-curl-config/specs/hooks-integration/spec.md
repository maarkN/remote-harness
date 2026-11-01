## MODIFIED Requirements

### Requirement: Idempotent hook installation
The installer SHALL merge into each profile's `settings.json` HTTP hooks for `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification` and `PermissionRequest` pointing to the local daemon, preserving all other keys and hooks in the file. Since Claude Code only runs `command` hooks on `SessionStart`, that event SHALL use a `command` hook that sends the same JSON to the daemon with `curl`, without writing anything to stdout (which would go into Claude's context) and without failing the session. That command MUST NOT contain the hook secret: `curl` reads the secret header from the hook secret's curl config file (see "Hook secret storage"). Running the installer twice MUST produce the same file.

#### Scenario: settings.json with user hooks
- **WHEN** the profile already has its own `Stop` hook
- **THEN** the user's hook stays there and the daemon's hook is added alongside it

#### Scenario: SessionStart via command
- **WHEN** a session starts or is resumed inside tmux
- **THEN** the daemon receives the `SessionStart` with the pane and the profile, and Claude receives no extra text in its context

#### Scenario: No secret on the command line
- **WHEN** the `SessionStart` hook runs
- **THEN** the `curl` process's arguments name the curl config file and do not contain the secret value

#### Scenario: Reinstall
- **WHEN** the installer runs a second time
- **THEN** no hook is duplicated

#### Scenario: Backup
- **WHEN** the installer changes a `settings.json`
- **THEN** a copy `settings.json.bak-claude-remote` is written first

## ADDED Requirements

### Requirement: Hook secret storage
The hook secret SHALL live in a `0600` file (`hook-secret`) in the daemon's data directory, next to a `0600` curl config file (`hook-secret.curlrc`) holding the same secret as a `header` line. Every `curl` command the installer writes — the Claude Code `SessionStart` hook, every Codex, Gemini CLI, Kimi CLI and Qwen Code hook, and the status line wrapper — SHALL pass that file with `-K` and MUST NOT contain the secret value, so the secret never appears in a process's arguments; only the `http` hooks of Claude Code's `settings.json` (a `0600` file read by Claude Code itself) carry the secret as a header value. `install`, `setup` and `update` SHALL write the curl config from the current secret. When they find a secret without a curl config, the secret was written by a version that put it on command lines, so they MUST replace it with a new one before writing the hooks and the status line, and tell the user; a running daemon uses the new secret once it restarts (`update` restarts the service). `remote-harness doctor` SHALL report whether the curl config exists and holds the current secret, pointing at `remote-harness install` when it does not.

#### Scenario: Upgrade from a version that exposed the secret
- **WHEN** `remote-harness update` finishes on an installation that has `hook-secret` but no `hook-secret.curlrc`
- **THEN** a new secret is written to both files, the hooks and the status line of every profile are rewritten with it, the output says the secret was rotated, and the restarted daemon accepts the new hooks

#### Scenario: Reinstall keeps the secret
- **WHEN** `remote-harness install` runs and both files hold the same secret
- **THEN** the secret is kept and no hooks file changes

#### Scenario: Process listing
- **WHEN** a hook or the status line runs `curl` while a session is open
- **THEN** the arguments of that process contain the path of the curl config and never the secret

#### Scenario: Curl config missing
- **WHEN** the user deletes `hook-secret.curlrc`
- **THEN** `remote-harness doctor` reports the hook secret for curl as missing and points at `remote-harness install`, which writes a new secret and its curl config
