## Why

The hook secret that authenticates every hook and status-line call to the daemon is written literally into the `curl` commands the installer generates (the Claude Code `SessionStart` hook, every Codex, Gemini CLI, Kimi CLI and Qwen Code hook, and the status line wrapper). A process's arguments are readable by any other local process (`ps`, `/proc/<pid>/cmdline`), so the only thing standing between a local process and an endpoint that types into agent sessions and answers permission prompts is exposed on every refresh of the status line (#452, advisory GHSA-ggrj-98v8-4p3x). The launcher already states the rule the rest of the daemon should follow: a secret "stays in the OS secret store and is read only inside the window, never on a command line".

## What Changes

- The installer writes the hook secret a second time as a `0600` curl config file (`hook-secret.curlrc`, next to `hook-secret`) holding the secret header, and every generated `curl` command passes that file with `-K` instead of a `-H` argument. The commands and the status line script carry a path, never the secret value.
- An installation that has a `hook-secret` but no curl config was made by a version that exposed the secret, so `install`, `setup` and `update` replace the secret once before rewriting the hooks and the status line, and say so. Later runs keep the secret.
- `remote-harness doctor` reports whether the curl config exists and matches the secret, pointing at `remote-harness install` otherwise.
- The hooks endpoint stays on `127.0.0.1` with the shared secret: Claude Code's `http` hooks need a URL, so a unix socket would only cover the curl paths and could not retire the secret (decision recorded in `design.md`). `SECURITY.md` and the security page of the docs describe where the secret lives.
- Messages in pt-BR, en-US and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hooks-integration`: "Idempotent hook installation" — the `SessionStart` command hook carries no secret value; a new requirement "Hook secret storage" — the two `0600` files, `-K` in every generated `curl`, the one-time rotation on upgrade and the doctor check.
- `status-line`: "Status line wrapper installation" — the wrapper script carries no secret value.

## Impact

- `apps/daemon/src/core/paths.ts` (the curl config path), `core/secrets.ts` (rotation), a new `features/hooks/hook-secret.ts` (curl config rendering, secret files, migration), `features/hooks/settings-hooks.ts`, `features/hooks/kimi-hooks.ts` (through `postCommand`), `features/status-line/wrapper.ts`, `features/hooks/installer.ts`, `features/setup/install.ts`, `cli.ts` (doctor), the three i18n catalogs, `SECURITY.md`, `apps/web/content/*/security.md`.
- No protocol change. Existing installations are migrated by the next `remote-harness update` (which runs the installer and restarts the service); Claude Code sessions open during that upgrade keep the hooks they captured at startup, with the old secret, until they are restarted.
