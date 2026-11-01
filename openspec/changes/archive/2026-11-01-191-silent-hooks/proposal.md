## Why

With the daemon stopped, every turn in Claude Code ends with `Stop hook error: connect ECONNREFUSED 127.0.0.1:7338` (#453): the Claude Code hooks are `http` hooks, and Claude Code reports an `http` hook that cannot connect as an error in the session, on every event, including on computers where the daemon is simply off. It makes an idle tool look broken and teaches people to ignore hook errors.

## What Changes

- Claude Code's hooks become `command` hooks running `curl`, like the Codex, Gemini CLI, Kimi CLI and Qwen Code ones already are: the output is discarded and the command always exits 0, so a stopped daemon is silent. `PermissionRequest` prints the daemon's answer on stdout (the same JSON the `http` hook received), and an empty answer (daemon down, timeout) lets Claude Code show its own prompt. The `http` type disappears from what the installer writes.
- `$TMUX_PANE` and `$CLAUDE_REMOTE_PROFILE` keep reaching the daemon as headers: the command form expands them from the hook's environment, no `allowedEnvVars` needed.
- A reinstall (`install`, `setup`, and `update` through its post-update install) replaces the `http` entries of an older install, since the remover recognizes them; nothing else is needed for the migration.
- The hook secret no longer appears in any `settings.json`: every hook reads it from the 0600 curl config.
- Tests: the generated hooks stay silent (empty stdout, exit 0) when the connection is refused; old `http` entries are migrated.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `hooks-integration`: "Idempotent hook installation" (command hooks for every event, silent when the daemon is down, migration of `http` entries), "Permission hook timeout" (curl's own timeout and the hook's), "Hook secret storage" (no hook carries the secret value any more).

## Impact

- `apps/daemon/src/features/hooks/settings-hooks.ts` (one `buildHookEntry` for Claude Code, Codex and Qwen Code; `secret` leaves `HookInstallOptions`), `apps/daemon/src/features/setup/install.ts`, tests in `apps/daemon/test/{hooks,codex,gemini,qwen,kimi}.test.ts`.
- Users get the new hooks on the next `remote-harness update` or `install`; nothing changes in what the daemon does with the events.
