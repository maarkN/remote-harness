## Context

The daemon already lets the phone type into a session's tmux pane, so a paired phone can in practice run anything the agent can. Still, running arbitrary shell commands directly, outside any agent and its permission checks, is a step up: it skips the agent's own sandbox and approval policy. The WebSocket is only reachable on the Tailscale interface (or 127.0.0.1 with `--dev`) and requires the pairing token.

## Goals / Non-Goals

**Goals:** run a one-off command in a session's folder and see its output on the phone; opt-in on the computer; confirmation per command on the phone; bounded time and output; cancel; nothing leaks to logs, other clients or push.

**Non-Goals:** interactive programs (stdin, TTY, curses), long-running servers, running in the agent's pane, a command history synced to the computer, `!` interception in the composer (Claude Code already handles a pasted `!` prompt in its own bash mode, so the composer keeps sending it to the agent).

## Decisions

- **Opt-in in the config file, toggled from the computer only.** `shellCommands.enabled` defaults to `false`. Only the CLI (`remote-harness commands on|off`, read → merge → backup → atomic write, then `POST /admin/commands-reload` on the hooks port, 127.0.0.1 with the secret) changes it; there is no protocol message to turn it on, so a stolen token alone cannot enable it. The daemon re-reads the block on reload; `auth.ok.commands.enabled` reflects it on the next connection, and `command.run` checks it on every call.
- **Confirmation per command in the app** (an alert showing the command and the folder, with a destructive-styled Run). The daemon does not trust the app for this; the opt-in is the server-side gate.
- **Executor in `infra/shell.ts`**: `spawn($SHELL or /bin/sh, ['-lc' | '-c', command], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' } })`. A login shell gives the user's `PATH` (the daemon runs under launchd/systemd with a minimal one). `detached` puts the shell in its own process group so cancel/timeout kill the whole tree (`process.kill(-pid)`): SIGTERM, then SIGKILL after 2 s. The executor is injected (`ShellSpawner`) so the service is tested without real processes.
- **One run per session, four in total.** A second run in the same session gets `session_busy`; beyond four, `session_busy` too. Runs belong to the connection that started them: output goes only there and closing the connection cancels them.
- **Limits.** `timeoutSec` (default 300, max 3600) kills the run with reason `timeout`. `maxOutputKb` (default 1024, max 10240) counts stdout + stderr bytes; once reached, the rest is dropped, the run is killed and ends with reason `output_limit` and `truncated: true`. The command itself is capped at 4000 characters by the schema.
- **Output path.** A `StringDecoder` per stream keeps UTF-8 sequences whole across chunks; ANSI escape sequences are stripped (the app shows plain monospaced text); chunks are batched for 50 ms (or 16 KB) into `command.output` messages, consecutive chunks of the same stream merged, and the batch is flushed before `command.exit`.
- **End reasons.** `exited` (with `exitCode`), `cancelled`, `timeout`, `output_limit`, `failed` (the shell could not start; `exitCode` null). `signal` names the signal when the process died of one.
- **Privacy.** The logger gets `{ sessionId, runId, reason, exitCode, durationMs, bytes }` only. Rejections go to diagnostics as type + code, like every request. No push, no broadcast, nothing persisted.
- **App.** A `commands` feature: `useCommandRun(sessionId)` (requests, listeners filtered by `runId`, cancel on unmount), a pure reducer for output (with its own display cap) and `promptBlock(command, output, exit)` building the fenced block added to the draft. The sheet is a `Modal` like the others; the entry is a `runCommand` item in `sessionMenu`, shown when `hello.commands` exists (older daemons hide it).

## Risks / Trade-offs

- [A paired phone with commands on can run anything as the user] → off by default, enabled only from the computer, confirmed per command, same transport security as the rest of the app; documented in the CLI help.
- [Login shell startup files print noise or are slow] → stdout/stderr show it as is; `-l` without `-i` skips most interactive setup.
- [A command ignoring SIGTERM] → SIGKILL to the group after 2 s.
- [Background processes started with `&` survive in a new group] → out of scope; the shell's own group is killed.
