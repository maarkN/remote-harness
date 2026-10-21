## Why

The Claude Code agent icon in the app (`apps/mobile/src/ui/agent-icons/ClaudeIcon.tsx`) is still the neutral placeholder from change 116: a filled circle that doesn't read as Claude Code. The landing already draws the Claude mark (`apps/web/src/agent-marks.ts`, from lobe-icons, MIT), the same spark Claude Code shows next to its prompt and spinner in the terminal. Issue #309 asks for that glyph in the app.

## What Changes

- `ClaudeIcon` draws the Claude spark: the same 24×24 path as the landing's `claude` mark, filled with the `color` prop, so the agent badge shows it in `AGENT_BADGE_INK` on the `#D97757` square at every size it is used (14–24 px).
- `agent-icons/README.md` records that `ClaudeIcon` is no longer a placeholder: its source (lobe-icons 1.95.1, MIT, shared with the landing) and that the mark is Anthropic's trademark, covered by the README and site footer notes.
- The Live Status mark (`LiveActivityIcon`) stays the app's own mark: it identifies Remote Harness for sessions of any agent, not Claude Code.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-shell`: the "Agent colors" requirement states that Claude Code's icon is its spark glyph, the same mark as the landing.

## Impact

- `apps/mobile/src/ui/agent-icons/ClaudeIcon.tsx`, `apps/mobile/src/ui/agent-icons/README.md`.
- No i18n, daemon, or protocol impact; callers (`AgentBadge`, `ProviderChip`) unchanged.
