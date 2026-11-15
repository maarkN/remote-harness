# hooks-integration Specification

## Purpose
Connects Claude Code sessions to the daemon through HTTP hooks installed in each profile.

## Requirements

### Requirement: Idempotent hook installation
The installer SHALL merge into each profile's `settings.json` `command` hooks for `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification` and `PermissionRequest` that post the event's JSON (stdin) to the local daemon with `curl`, with the tmux pane and the profile as headers taken from the hook's environment, preserving all other keys and hooks in the file. Every hook except `PermissionRequest` MUST discard the daemon's answer and write nothing to stdout (a `SessionStart` or `UserPromptSubmit` stdout would go into Claude's context), and every hook MUST exit 0 whatever happens, so a daemon that is stopped, unreachable or slow never shows an error in the session. `PermissionRequest` SHALL print the daemon's answer on stdout, which Claude Code reads as the hook's decision; an empty answer (daemon down, timeout) MUST leave Claude Code to its own prompt. No hook MAY be of type `http`, and no command MAY contain the hook secret: `curl` reads the secret header from the hook secret's curl config file (see "Hook secret storage"). Running the installer twice MUST produce the same file, and running it over the `http` hooks of an older version MUST replace them.

#### Scenario: settings.json with user hooks
- **WHEN** the profile already has its own `Stop` hook
- **THEN** the user's hook stays there and the daemon's hook is added alongside it

#### Scenario: SessionStart via command
- **WHEN** a session starts or is resumed inside tmux
- **THEN** the daemon receives the `SessionStart` with the pane and the profile, and Claude receives no extra text in its context

#### Scenario: No secret on the command line
- **WHEN** any of the hooks runs
- **THEN** the `curl` process's arguments name the curl config file and do not contain the secret value

#### Scenario: Daemon stopped
- **WHEN** the daemon is not running and a session starts, takes a prompt, ends its turn and ends
- **THEN** every hook exits 0 with an empty stdout and Claude Code shows no hook error

#### Scenario: Permission while the daemon is stopped
- **WHEN** the daemon is not running and Claude Code asks for a permission
- **THEN** the `PermissionRequest` hook prints nothing and exits 0, and Claude Code shows its own permission prompt

#### Scenario: Permission answered from the phone
- **WHEN** the daemon is running and the user allows a request from the phone
- **THEN** the hook prints the daemon's decision JSON and Claude Code applies it, as it did with the `http` hook

#### Scenario: Pane and profile headers
- **WHEN** a hook runs inside a tmux pane started by a profile launcher
- **THEN** the daemon receives the event with the pane id and the profile from the command's environment

#### Scenario: Upgrade from http hooks
- **WHEN** `remote-harness install` (or the install run after `update`) finds a `settings.json` with the `http` hooks of an older version
- **THEN** those entries are replaced by the `command` hooks and the user's own hooks are untouched

#### Scenario: Reinstall
- **WHEN** the installer runs a second time
- **THEN** no hook is duplicated

#### Scenario: Backup
- **WHEN** the installer changes a `settings.json`
- **THEN** a copy `settings.json.bak-remote-harness` is written first

### Requirement: Uninstall
`uninstall` SHALL remove only the hooks, the `~/.zshrc` block and the launchers created by the installer.

#### Scenario: Clean removal
- **WHEN** the user runs `uninstall`
- **THEN** `settings.json` goes back to containing only the user's hooks

### Requirement: Event reception
The daemon SHALL accept `POST /hooks/<event>` with the Claude Code payload, identify the profile and the tmux pane from the headers sent by the hook, and publish the event internally. Non-permission events MUST be answered immediately with an empty body, without blocking the session.

#### Scenario: SessionStart from a launcher session
- **WHEN** `SessionStart` arrives with pane header `%12` and profile `claudin`
- **THEN** the daemon associates the `session_id` with pane `%12` and profile `claudin`

#### Scenario: Daemon down
- **WHEN** Claude Code fires a hook and the daemon is not running
- **THEN** the Claude session continues normally (the hook fails without blocking)

### Requirement: Permission hook timeout
The `PermissionRequest` hook's `curl` SHALL give up after `max(hookPermissionTimeoutSec, questionTimeoutSec + 20)` seconds, longer than both daemon waits, so the daemon always answers before the request is abandoned, and the hook's own `timeout` SHALL be 10 seconds more, so an abandoned request ends as an empty answer (Claude Code's own prompt) rather than a killed hook. `install` and `update` SHALL rewrite existing hooks with the new timeouts.

#### Scenario: Default config
- **WHEN** the hooks are installed with the default config
- **THEN** the Claude Code `PermissionRequest` hook runs `curl` with `-m 3320` and has `timeout: 3330`

### Requirement: Hook secret storage
The hook secret SHALL live in a `0600` file (`hook-secret`) in the daemon's data directory, next to a `0600` curl config file (`hook-secret.curlrc`) holding the same secret as a `header` line. Every `curl` command the installer writes — every Claude Code, Codex, Gemini CLI, Kimi CLI and Qwen Code hook, and the status line wrapper — SHALL pass that file with `-K` and MUST NOT contain the secret value, so the secret never appears in a process's arguments nor in any hooks file. `install`, `setup` and `update` SHALL write the curl config from the current secret. When they find a secret without a curl config, the secret was written by a version that put it on command lines, so they MUST replace it with a new one before writing the hooks and the status line, and tell the user; a running daemon uses the new secret once it restarts (`update` restarts the service). `remote-harness doctor` SHALL report whether the curl config exists and holds the current secret, pointing at `remote-harness install` when it does not.

#### Scenario: Upgrade from a version that exposed the secret
- **WHEN** `remote-harness update` finishes on an installation that has `hook-secret` but no `hook-secret.curlrc`
- **THEN** a new secret is written to both files, the hooks and the status line of every profile are rewritten with it, the output says the secret was rotated, and the restarted daemon accepts the new hooks

#### Scenario: Reinstall keeps the secret
- **WHEN** `remote-harness install` runs and both files hold the same secret
- **THEN** the secret is kept and no hooks file changes

#### Scenario: Process listing
- **WHEN** a hook or the status line runs `curl` while a session is open
- **THEN** the arguments of that process contain the path of the curl config and never the secret

#### Scenario: Secret absent from settings.json
- **WHEN** the hooks are installed in a Claude Code profile
- **THEN** its `settings.json` contains the curl config path and never the secret value

#### Scenario: Curl config missing
- **WHEN** the user deletes `hook-secret.curlrc`
- **THEN** `remote-harness doctor` reports the hook secret for curl as missing and points at `remote-harness install`, which writes a new secret and its curl config
