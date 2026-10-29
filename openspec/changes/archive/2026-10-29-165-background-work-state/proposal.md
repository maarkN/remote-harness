## Why

With Claude Code's multi-agent workflows (e.g. `ultracode`) or background subagents, the turn ends (`Stop`) while agents keep working; the daemon maps every `Stop` to `idle`, so the app, the pushes and the live status say the session is done while it is still working (#439).

## What Changes

- Claude Code's `Stop` hook carries `background_tasks`: the in-flight background work of the session, each item with a `type` (`shell`, `subagent`, `monitor`, `workflow`, …) and a `status`. A `Stop` whose list still has agent work in flight (`subagent` or `workflow` items not in a final status) keeps the session `running` instead of `idle`. Background shells and monitors do not: a dev server or a watch can run for hours and the session is ready for a prompt meanwhile.
- When the agent work finishes, Claude Code wakes the session with the task notifications and ends that turn with another `Stop`; once its list has no agent work left, the session becomes `idle`.
- Such a `Stop` sends no "session finished" push, and the live status stays working; both follow the final `Stop`.
- `SubagentStop` carries the same list: the session's background task count is refreshed from it too.
- Fixture tests replay the hook sequence of a workflow run (shape from Claude Code's hook input schema, no personal content).

## Capabilities

### New Capabilities

### Modified Capabilities
- `session-registry`: `Stop` with agent work in flight keeps the session `running`.
- `subagents`: background task count also from `SubagentStop`.
- `push-notifications`: no "session finished" push while agent work is in flight.
- `live-status`: the live status stays working while agent work is in flight.

## Impact

- Daemon: `features/sessions/state.ts` (pure rule), `features/sessions/service.ts`, `features/subagents/tracker.ts`, `features/push/service.ts`, `features/live-status/index.ts`; fixture under `apps/daemon/test/fixtures`.
- No protocol change: the session is `running` and the app already shows the background task badge. Codex sends no `background_tasks`, so its sessions keep the current rules.
