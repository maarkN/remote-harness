## Why

The "Session status" sheet (tokens, limits) only has a Close button, so to see the session details (folder, branch, profile, mode, session ID) the user has to close it and find the title or the folder in the header (#438). The two sheets answer neighbouring questions about the same session; one tap should lead from one to the other.

## What Changes

- A **Session details** row at the bottom of the Session status sheet, on phones and tablets alike: tapping it closes the status sheet and opens the Session details sheet (the same one the header title and the folder open).
- Its label and hint are translated (pt-BR, en-US, es-ES).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: "Status bar" — the status sheet also offers the session details.

## Impact

- `apps/mobile/src/features/session-status/StatusSheet.tsx` and `StatusBar.tsx` (an optional details action, the handoff between the two sheets), the session route (`src/app/(main)/session/[id]/index.tsx`) wiring it to the existing details sheet, i18n keys in the three catalogs. No protocol or daemon change.
