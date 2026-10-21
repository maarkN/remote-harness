## Why

For Claude Code sessions the app shows the model, the effort, the context usage and the account's 5-hour and 7-day limits (the status bar under the session header and its sheet), all fed by Claude Code's `statusLine`. Codex has no status line hook, so a Codex session shows none of it: you can't tell which model is running or how close the session is to its context window or to the account's rate limits (issue #313). Codex already writes all of it to the rollout: `turn_context` lines carry the model and the reasoning effort, and `token_count` events carry the token usage, the model's context window and the account's rate limits.

## What Changes

- The Codex format module reads `turn_context` (model, effort) and `event_msg` `token_count` (last turn's token usage, `model_context_window`, `rate_limits.primary` / `secondary`) lines.
- These map to the same protocol fields the app already uses for Claude Code: `Session.status` (`model`, `effort`, `context`) and `limits.updated` for the session's profile (`fiveHour`, `sevenDay`). No protocol or app change.
- Context usage follows the Codex TUI's own formula (a 12k-token baseline left out of both the used tokens and the window), so the app's percentage matches the "% context left" Codex shows.
- Rate limit windows map by their length (`window_minutes`: up to a day is the 5-hour slot, longer is the 7-day slot), falling back to primary → 5-hour and secondary → 7-day when the length is missing. Reset times come from `resets_at` (epoch seconds) or `resets_in_seconds` relative to the line's timestamp; a window without a reset time stays unknown.
- The status is known as soon as the session is registered (read from the rollout's head and tail with the rest of the summary) and kept current while the transcript is followed.
- Rollouts without these lines (older Codex versions, API-key accounts with `rate_limits: null`) leave the items unknown, never zero.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `codex-sessions`: new requirement "Codex session status".

## Impact

- `apps/daemon/src/features/transcript/codex-format.ts`: status parsing (pure), `parseCodexMeta` and `extractCodexMeta` return it.
- `apps/daemon/src/features/transcript/format.ts`: `TranscriptMetaUpdate` gains `status` and `limits`.
- `apps/daemon/src/features/agents/types.ts`, `codex.ts`: `TranscriptSummary` gains optional `status` and `limits`.
- `apps/daemon/src/features/transcript/index.ts`, `sessions/service.ts`: apply them to the session (merging partial updates, keeping `updatedAt`).
- `apps/daemon/src/core/events.ts`, `features/status-line/`: limits reported through a bus event and broadcast by the status line service (deduplicated per profile).
- Tests: Codex parser with real-shaped `token_count` / `turn_context` lines, status line service limits from the bus.
- Claude Code sessions are unchanged.
