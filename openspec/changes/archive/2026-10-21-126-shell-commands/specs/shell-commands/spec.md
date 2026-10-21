## ADDED Requirements

### Requirement: Opt-in on the computer
Running shell commands from the app SHALL be off by default. The daemon config SHALL have a `shellCommands` block with `enabled` (default `false`), `timeoutSec` (default 300, at most 3600) and `maxOutputKb` (default 1024, at most 10240). The CLI command `remote-harness commands [on|off]` SHALL show or change `enabled` (read → merge → backup → atomic write) and reload a running daemon through its local admin route; no WebSocket message SHALL change it. While it is off, `command.run` MUST fail with `commands_disabled`. `auth.ok` SHALL carry `commands: { enabled }`.

#### Scenario: Off by default
- **WHEN** a fresh install receives `command.run`
- **THEN** it answers `commands_disabled` and runs nothing

#### Scenario: Turned on from the computer
- **WHEN** the user runs `remote-harness commands on` while the daemon runs
- **THEN** the config has `shellCommands.enabled: true`, the daemon accepts runs without a restart and new connections get `commands.enabled: true`

### Requirement: Running a command
`command.run` (`sessionId`, `command` of 1 to 4000 characters) SHALL run the command with the user's login shell (`$SHELL -lc`, else `/bin/sh -c`) in the session's working directory, in its own process group, with stdin closed, and SHALL answer `command.started` with a `runId` and the folder. An unknown session MUST fail with `not_found` and a missing folder with `invalid_cwd`. A session SHALL have at most one run at a time and the daemon at most four; more MUST fail with `session_busy`. Output SHALL be sent as `command.output` (`runId`, `stream` `stdout` or `stderr`, `text` decoded as UTF-8 with ANSI escapes removed, batched) and the end as `command.exit` (`runId`, `exitCode` or `null`, `signal` or `null`, `reason` `exited` | `cancelled` | `timeout` | `output_limit` | `failed`, `durationMs`, `truncated`), only to the connection that started the run.

#### Scenario: Successful command
- **WHEN** the app runs `git status` in a session whose folder is a git repository
- **THEN** it receives `command.started`, the status text as `command.output` on `stdout` and `command.exit` with `reason` `exited` and `exitCode` 0

#### Scenario: Failing command
- **WHEN** the command writes to stderr and exits with 2
- **THEN** the text arrives on `stderr` and `command.exit` has `exitCode` 2

#### Scenario: Busy session
- **WHEN** a second `command.run` arrives for a session whose previous command is still running
- **THEN** it fails with `session_busy`

### Requirement: Limits and cancel
A run SHALL be killed (SIGTERM to its process group, SIGKILL after 2 s) when it runs past `timeoutSec` (reason `timeout`), when its stdout and stderr together pass `maxOutputKb` (the rest is dropped; reason `output_limit`, `truncated: true`), on `command.cancel` from the connection that started it (reason `cancelled`), and when that connection closes.

#### Scenario: Timeout
- **WHEN** a command keeps running past the timeout
- **THEN** its process group is killed and `command.exit` has `reason` `timeout`

#### Scenario: Endless output
- **WHEN** a command prints without end (`yes`)
- **THEN** the app receives at most `maxOutputKb` of output and `command.exit` with `reason` `output_limit` and `truncated: true`

#### Scenario: Cancel
- **WHEN** the app sends `command.cancel` for its running command
- **THEN** the command is killed and `command.exit` has `reason` `cancelled`

### Requirement: Privacy
Commands and their output MUST NOT be logged, persisted, broadcast to other clients or sent in push notifications. The daemon log MAY record that a command ran: the session, the run id, the end reason, the exit code, the duration and the number of output bytes.

#### Scenario: Log line
- **WHEN** a command with a token in its arguments runs
- **THEN** the daemon log has a "command ran" line with the session and exit status and neither the command nor its output

### Requirement: Run command sheet
The session's More options menu SHALL offer "Run command…" when the daemon's `auth.ok` has `commands`. It SHALL open a sheet with a monospaced command field (no autocorrect or capitalization) and the session's folder. Running SHALL ask for confirmation every time, showing the command and the folder. The output SHALL stream into a scrollable, selectable, monospaced panel that stays at the end while new output arrives, with the state (running with elapsed time, exit code, cancelled, timed out, output limit reached, failed to start), Cancel while running, Copy output and "Add to prompt", which appends the command and its output as a fenced code block to the session's composer draft without sending it. Closing the sheet cancels a running command. When `commands.enabled` is false the sheet SHALL say that commands are off on the computer and show the command that turns them on. Texts SHALL be translated (en-US, pt-BR, es-ES).

#### Scenario: Confirm before running
- **WHEN** the user types `pnpm test` and taps Run
- **THEN** an alert asks to run `pnpm test` in the session's folder, and nothing runs until the user confirms

#### Scenario: Add to prompt
- **WHEN** a command finished and the user taps "Add to prompt"
- **THEN** the session's draft gains a fenced block with `$ <command>`, its output and the exit status, the sheet closes and nothing is sent yet

#### Scenario: Commands off
- **WHEN** the daemon reports `commands.enabled: false`
- **THEN** the sheet shows that commands are off and `remote-harness commands on`, with no Run button
