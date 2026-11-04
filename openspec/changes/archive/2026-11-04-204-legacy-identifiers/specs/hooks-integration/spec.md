## MODIFIED Requirements

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
