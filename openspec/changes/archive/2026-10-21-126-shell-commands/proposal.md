## Why

In Claude Code, `!` runs a shell command and shows its output. From the app there is no way to run a quick command (`git status`, `ls`, `pnpm test`) in a session's folder without opening the raw terminal and typing into the agent's pane (issue #308). This is remote code execution on the user's machine, so it has to be off by default, explicit, bounded and private.

## What Changes

- **Opt-in on the computer.** A new `shellCommands` config block (`enabled`, default `false`; `timeoutSec`, default 300; `maxOutputKb`, default 1024) and a CLI command `remote-harness commands [on|off]` that writes it and reloads the running daemon. While off, the daemon rejects every run with `commands_disabled`.
- **Protocol** (`packages/protocol`): `command.run` (`sessionId`, `command`) answered with `command.started` (`runId`, `cwd`); `command.cancel` (`runId`); server messages `command.output` (`runId`, `stream`, `text`) and `command.exit` (`runId`, `exitCode`, `signal`, `reason`, `durationMs`, `truncated`), sent only to the connection that started the run; `auth.ok` gains `commands: { enabled }` so the app knows the daemon supports runs and whether they are allowed; new error code `commands_disabled`.
- **Daemon**: an executor in `infra/shell.ts` runs the command with the user's login shell (`$SHELL -lc`, else `/bin/sh -c`) in the session's working directory, in its own process group, with stdin closed, and streams stdout/stderr. A `shell` feature enforces one run per session (`session_busy`), at most four at once, the timeout, the output cap (the run is killed once it is reached) and cancel (SIGTERM to the group, SIGKILL after 2 s); a closed connection cancels its runs. Output is decoded as UTF-8, ANSI escapes are stripped and chunks are batched. The log records that a command ran (session, run id, exit, duration, bytes), never the command or its output.
- **App**: "Run command…" in the session's More options menu (when the daemon supports it) opens a sheet with a monospaced command field and the session's folder. Running asks for confirmation (command and folder) every time; the output streams into a scrollable, selectable, monospaced panel with the exit status, Cancel while running, Copy, and "Add to prompt", which appends the command and its output as a fenced block to the session's composer draft (like `!`), without sending it. When commands are off on the computer the sheet explains how to turn them on.
- Texts in en-US, pt-BR and es-ES (app and daemon CLI).
- Push notifications never carry commands or output; nothing is broadcast to other clients.

## Capabilities

### New Capabilities

- `shell-commands`: running shell commands from the app in a session's folder: opt-in, protocol, limits, privacy and the app sheet.

### Modified Capabilities

(none)

## Impact

- `packages/protocol/src/{client,server,domain}.ts`: messages, `CommandEndReason`, `MAX_COMMAND_LENGTH`, error code, `auth.ok.commands`.
- `apps/daemon/src/core/config.ts` (`shellCommands`), `infra/shell.ts`, `features/shell/{index,service,output}.ts`, `main.ts` (wiring, hello), `cli.ts` (`commands` command), daemon i18n.
- `apps/mobile/src/features/commands/` (sheet, hook, pure logic), session menu item, app i18n.
- Tests: protocol parsing, daemon output buffer and service (fake spawner: limits, cap, timeout, cancel, disabled, privacy of logs), executor against a real `/bin/sh`, app pure logic (output reducer, prompt block).
