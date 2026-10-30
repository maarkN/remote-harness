## Why

When a question or plan approval is answered in the terminal on the computer while its `PermissionRequest` hook is still open, the app keeps showing it (#437). The broker's session watch only ends requests already handed over to the terminal; a request whose hook is open stays pending until Claude Code closes the hook or `questionTimeoutSec` runs out, and the session stays "waiting".

## What Changes

- When the session moves on while a request's hook is still open, the daemon settles that request: it ends the hook with an empty answer (the agent already has the terminal's answer), broadcasts `permission.resolved` with `cancelled`, and the app removes the card; live status and reminders end with it.
- Questions and plan approvals settle on any sign the session moved on (a tool result, a new prompt, a turn hook). Tool permissions settle only on turn signals (a new prompt, `UserPromptSubmit`, `Stop`, `Interrupt`, `SessionEnd`): the hook carries no tool-use id, and a tool result may come from a tool that ran in parallel.
- A request settled by a tool result puts the session back to `running` (the turn continues), like an answer from the phone.

## Capabilities

### New Capabilities

### Modified Capabilities
- `permission-approval`: requests answered in the terminal while the hook is open are settled.

## Impact

- Daemon: `features/permissions/broker.ts`, `handover.ts`, `index.ts`; `features/sessions/index.ts`; `core/events.ts`.
- No protocol change; the app already drops a resolved request.
