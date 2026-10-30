## Why

Codex sessions still lack features Claude Code sessions have (#423): they cannot start in a worktree or with a lasting name, their permissions cannot be switched from the app, the permission card offers an "Always" button that Codex silently ignores, and Polish dictation and generated commit messages are Claude Code only. Codex (0.163+) now has the pieces to close most of these gaps: `codex --worktree`, `/rename <name>`, `/permissions <profile>` (0.164+) and `codex exec --json --ephemeral`.

## What Changes

- New Codex sessions can start in a Codex-managed git worktree (`codex --worktree`); the app shows the worktree option for Codex profiles.
- A Codex session started with a name gets that name as its Codex thread name: the daemon types `/rename <name>` into the pane once the session registers, so the title survives daemon restarts (Codex has no name flag).
- The daemon reads the Codex permission profile (`:read-only`, `:workspace`, `:danger-full-access` or a named one) from the rollout next to the approval policy and sends it on `Session` as `permissionProfile`.
- `session.setMode` accepts the Codex presets `read-only` and `workspace` for Codex sessions and switches them by typing `/permissions :read-only|:workspace`; full access (and anything else) is refused with `mode_forbidden`. The app's Codex chip shows the permission profile and opens a picker with these two presets, noting that full access is only available in the terminal.
- `PermissionRequestInfo` gains `rules` (default `true`): `false` for agents that cannot take always-allow rules (Codex). The app hides the Always action for those requests and says why.
- Codex gets a one-shot call: Polish dictation and generated commit/PR messages run `codex exec --json --ephemeral` (read-only sandbox, no user config, low reasoning effort) and read the last agent message. Each adapter now parses its own one-shot output.
- Out of scope: model providers for Codex profiles (Codex configures its own providers) and wrapping Codex's status line (its status already comes from the rollout).

## Capabilities

### New Capabilities

### Modified Capabilities
- `codex-sessions`: worktree allowed at start, permission profile read from the rollout, permissions switchable from the app, no Always with a reason, one-shot call.
- `session-lifecycle`: session name at start reaches Codex as its thread name.
- `app-conversation`: Codex chip opens a permissions picker; worktree option shown for Codex.
- `protocol`: `Session.permissionProfile`, `PermissionRequestInfo.rules`, Codex presets on `session.setMode`.
- `voice-input`: Polish dictation also for Codex profiles.
- `session-changes`: generated messages also through Codex.
- `permission-approval`: the Always action is hidden for requests without rules.

## Impact

- `packages/protocol` (domain schemas).
- Daemon: `features/agents` (Codex adapter, adapter type), `features/transcript/codex-format.ts`, `features/sessions`, `features/mode`, `features/lifecycle`, `features/permissions/broker.ts`, `features/voice-polish`, `features/changes/generate.ts`, `main.ts` wiring.
- App: `features/mode`, `features/lifecycle/new-session.ts`, `features/permissions` components, `features/sessions/details.ts`, i18n catalogs (pt-BR, en-US, es-ES), demo fixtures.
- Requires Codex 0.164+ for switching permissions from the app; older Codex versions ignore the command and the chip keeps showing the real profile.
