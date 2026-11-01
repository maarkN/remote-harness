## Context

See proposal.md — Why. Today `ensureHookSecret()` (`core/secrets.ts`) creates `hook-secret` (0600) on first use, by the daemon at start or by the CLI; `installAll` (`features/setup/install.ts`) reads it and hands the value to `renderStatusLineScript` and to the hook builders (`settings-hooks.ts`, `kimi-hooks.ts`), which interpolate it as `-H "x-claude-remote-secret: …"`. The hooks server (`transport/hooks-server.ts`) checks the header in constant time. Codex and Kimi run their command hooks through `$SHELL -lc`, so the generated command must work in bash, zsh and fish alike. Claude Code captures its hooks when a session starts; edits to `settings.json` reach only new sessions.

## Goals / Non-Goals

**Goals:**
- No generated command line (hooks of any agent, status line wrapper) carries the secret value.
- An installation upgraded from an exposing version gets a fresh secret exactly once, and everything that depends on it (hooks files, status line script, curl config) is rewritten in the same run.
- `doctor` can tell when the curl config is missing or stale.

**Non-Goals:**
- Changing the transport of the hooks endpoint (unix socket), the permissions of `settings.json`, or the pairing/relay/push paths.
- Removing the secret from the `http` hooks in `settings.json`: Claude Code reads them from a 0600 file, not from a command line.

## Decisions

1. **A curl config file read with `-K`, not `-H @file` nor a shell read of `hook-secret`.** `-K <file>` is in every curl ever shipped, needs no shell feature (the command must survive bash, zsh and fish through `$SHELL -lc`), and leaves only a path on the command line. `-H @file` needs curl ≥ 7.55; reading `hook-secret` into a shell variable would still end up as an argument. The file holds a single `header = "x-claude-remote-secret: …"` line (backslash and double quote escaped per curl's quoting), is written atomically with mode 0600, and lives next to `hook-secret` in the data directory (`paths.hookCurlConfig()`, `hook-secret.curlrc`), so the legacy `~/.claude-remote` directory is handled like today.
2. **The hooks endpoint stays on `127.0.0.1` with the shared secret** (the issue's open TODO). Six of Claude Code's seven hooks are `http` hooks that take a URL, so a unix socket could only serve the curl paths; the daemon would then run two listeners for the same routes and still need the secret for the `http` hooks. The exposure was the argument list, which `-K` closes; the control described in `SECURITY.md` is unchanged.
3. **Only the installer writes the curl config; the daemon does not.** `ensureHookSecret()` keeps creating `hook-secret` for the daemon at start. Because the daemon never writes the curl config, "`hook-secret` exists and `hook-secret.curlrc` does not" is a reliable marker that the secret came from an exposing version, whatever started first after the code was updated — the daemon or the CLI. `ensureHookSecretFiles()` (`features/hooks/hook-secret.ts`) implements the four cases: fresh install (create both), migration (rotate, write both, report), steady state (keep; rewrite the config only when its content differs) and a stale config (rewrite from the secret). It replaces `ensureHookSecret()` in `installAll`, which prints a line when the secret was rotated.
4. **Rotate once, not on every upgrade.** Claude Code captures hooks at session start, so every rotation breaks the hooks (and the permission bridge) of the sessions open at that moment until they restart. Paying that once, for the secret that may have been exposed, is the point of the issue; paying it on every update would make updates disruptive for no gain, since the new code never exposes the secret. Alternative considered: a version marker in `state.json` — more moving parts for the same signal the curl config already gives.
5. **`doctor` checks the curl config instead of the daemon healing it.** A missing or stale `hook-secret.curlrc` silently breaks the curl-based hooks; `doctor` reports it with the existing `run remote-harness install` hint, which rewrites it (rotating the secret when the config was missing, per decision 3).

## Risks / Trade-offs

- [Sessions open during the upgrade lose their hooks until restarted] → one-time, said in the release notes and the PR; the status line keeps working at once because its script path does not change and the script is read on every refresh.
- [A daemon started by hand (`remote-harness start`) keeps the old secret after `install` rotates it] → the install output says the secret was rotated and that a running daemon uses it after a restart; `update` restarts the service itself.
- [Data directory moved after install (`REMOTE_HARNESS_HOME`)] → the baked path goes stale exactly like the launcher paths today; `install` rewrites it. Paths are shell-quoted, so spaces or quotes in the home directory are safe.
- [Rolling back to an older version] → the old code ignores the curl config and writes the secret back on the command lines: functional, but exposed again.

## Migration Plan

Ships in the next release. `remote-harness update` builds the new version, runs `update --finish` (= `installAll`: rotation, curl config, hooks, status line) and restarts the service when it is installed. Manual installs do the same through `remote-harness install`. Nothing to roll back: deleting `hook-secret.curlrc` and running `install` regenerates everything.
