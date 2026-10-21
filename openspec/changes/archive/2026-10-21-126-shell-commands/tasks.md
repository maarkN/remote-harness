## 1. Protocol

- [x] 1.1 `command.run`, `command.cancel`, `command.started`, `command.output`, `command.exit`, `CommandEndReason`, `MAX_COMMAND_LENGTH`, `commands_disabled`, `auth.ok.commands`; tests.

## 2. Daemon

- [x] 2.1 `shellCommands` config block (defaults, bounds); test.
- [x] 2.2 `infra/shell.ts`: login shell, process group, closed stdin, kill with SIGTERM then SIGKILL; test against `/bin/sh`.
- [x] 2.3 `features/shell/output.ts` (pure): ANSI stripping, UTF-8 decoding, byte cap, batching of same-stream chunks; tests.
- [x] 2.4 `features/shell/service.ts`: opt-in check, session/cwd checks, per-session and global limits, timeout, cap, cancel, connection close, owner-only output, privacy-safe log line; tests with a fake spawner.
- [x] 2.5 `features/shell/index.ts`: handlers, `/admin/commands-reload`; `main.ts` wiring and `auth.ok.commands`.
- [x] 2.6 CLI `remote-harness commands [on|off]` with i18n (en-US, pt-BR, es-ES).

## 3. App

- [x] 3.1 `features/commands/logic.ts` (pure): output reducer with a display cap, end state labels, `promptBlock`; tests.
- [x] 3.2 `useCommandRun` hook and `CommandSheet` (field, folder, confirmation, streaming output, Cancel, Copy, Add to prompt, off notice).
- [x] 3.3 "Run command…" in the session menu when the daemon supports it; i18n keys in the three catalogs.

## 4. Verification

- [x] 4.1 `pnpm check` green and `npx expo export --platform ios` bundles.
