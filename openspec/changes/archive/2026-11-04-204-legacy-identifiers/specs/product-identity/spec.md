## ADDED Requirements

### Requirement: Identifiers on the computer
Everything Remote Harness registers on the computer SHALL carry its own name: the launchd label and bundle identifier `com.alvyntech.remoteharness.daemon`, the systemd unit `remote-harness.service`, the `service` attribute `remote-harness` of its Keychain and Secret Service entries, the default tmux session `remote-harness`, the hook headers `x-remote-harness-secret`, `x-remote-harness-pane` and `x-remote-harness-profile`, the launcher variables `REMOTE_HARNESS_PROFILE`, `REMOTE_HARNESS_NO_ATTACH`, `REMOTE_HARNESS_TMUX`, `REMOTE_HARNESS_<AGENT>_BIN`, `REMOTE_HARNESS_EXEC` and `REMOTE_HARNESS_PROMPT`, the backup suffix `.bak-remote-harness` and the shell PATH block markers `# >>> remote-harness >>>` / `# <<< remote-harness <<<`. `remote-harness update`, `install` and `service install` SHALL migrate an install made before the rename without breaking it: the legacy LaunchAgent (`tech.doctorx.claude-remote`) or unit (`claude-remote.service`) is unloaded and removed before the new one loads, the secrets stored under the legacy service are copied to the new one (the legacy entries are left in place), a live tmux session `claude-remote` is renamed to the configured session when that one does not exist and `config.json` does not pin the old name, and the legacy PATH block is replaced by the new one. For the sessions already running, the daemon SHALL accept the legacy hook headers and the launchers SHALL also export `CLAUDE_REMOTE_PROFILE`, and the generated hook commands SHALL read `REMOTE_HARNESS_PROFILE` with `CLAUDE_REMOTE_PROFILE` as fallback. The `claude-remote` CLI alias stays (see "CLI command and alias").

#### Scenario: Update migrates the service
- **WHEN** `remote-harness update` finishes on a Mac whose LaunchAgent is `tech.doctorx.claude-remote`
- **THEN** that agent is booted out and its plist removed, `com.alvyntech.remoteharness.daemon.plist` is written and bootstrapped, and `remote-harness service status` shows the new label loaded

#### Scenario: Secrets follow
- **WHEN** the daemon identity and a profile's provider key are stored under the Keychain service `claude-remote` and the update finishes
- **THEN** both exist under the service `remote-harness`, the daemon reads them from there, and the paired devices keep working without pairing again

#### Scenario: tmux session renamed
- **WHEN** the Remote Harness tmux server has a session `claude-remote` with live windows, none named `remote-harness`, and `config.json` has no `tmuxSession`
- **THEN** the session is renamed to `remote-harness`, its windows and panes untouched, and the next launcher opens its window there

#### Scenario: Pinned session name
- **WHEN** `config.json` sets `"tmuxSession": "claude-remote"`
- **THEN** nothing is renamed and the launchers keep using that session

#### Scenario: Hooks of an older session
- **WHEN** a session started before the update sends a hook with the `x-claude-remote-*` headers and `$CLAUDE_REMOTE_PROFILE` from its pane
- **THEN** the daemon accepts it exactly as a hook with the new headers

## MODIFIED Requirements

### Requirement: Data directory
The data directory SHALL be the `REMOTE_HARNESS_HOME` (or `CLAUDE_REMOTE_HOME`) override, else `~/.remote-harness`. An install whose data still lives in `~/.claude-remote` SHALL have that directory moved to `~/.remote-harness` once, by the installer (also when it runs as `remote-harness update`) or by the CLI when it starts, leaving a symbolic link `~/.claude-remote` → `~/.remote-harness` behind so that sessions, hooks and launchers still running from the old path keep working until they are regenerated or end. With the override set, or when `~/.remote-harness` already exists, nothing MUST be moved.

#### Scenario: Existing install
- **WHEN** only `~/.claude-remote` exists and the user runs `remote-harness update`
- **THEN** the directory is moved to `~/.remote-harness`, `~/.claude-remote` becomes a link to it, and the daemon reads and writes `~/.remote-harness`

#### Scenario: Session from before the move
- **WHEN** a Claude Code session started before the update runs a hook whose command names `~/.claude-remote/hook-secret.curlrc`
- **THEN** the hook reaches the daemon through the link

#### Scenario: New install
- **WHEN** neither directory exists
- **THEN** the daemon uses `~/.remote-harness`

#### Scenario: Override
- **WHEN** `REMOTE_HARNESS_HOME=/tmp/x` is set and `~/.claude-remote` exists
- **THEN** nothing is moved and the daemon uses `/tmp/x`
