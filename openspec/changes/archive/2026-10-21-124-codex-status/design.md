## Context

Claude Code reports its status through the `statusLine` wrapper: `POST /statusline` → `StatusLineService` → `Session.status` (model, effort, context) on the session and `limits.updated` per profile. The app's `StatusBar` / `StatusSheet` are agent-agnostic: they render `session.status` and the limits of `session.profileId`.

Codex (read from codex 0.163) has no status line, but its rollout records:

```jsonc
{"type":"turn_context","payload":{"model":"gpt-5.5-codex","effort":"medium", …}}
{"type":"event_msg","payload":{"type":"token_count",
  "info":{"total_token_usage":{…},"last_token_usage":{"input_tokens":…,"total_tokens":…},"model_context_window":272000},
  "rate_limits":{"primary":{"used_percent":12.0,"window_minutes":300,"resets_at":1792000000},
                 "secondary":{"used_percent":3.0,"window_minutes":10080,"resets_at":1792400000}}}}
```

`info` is `null` before the first response; `rate_limits` is `null` for API-key accounts. Older versions wrote `resets_in_seconds` instead of `resets_at`.

## Goals / Non-Goals

**Goals:** model, effort, context % and both rate-limit windows for Codex sessions, through the existing protocol fields; nothing changes for Claude Code.

**Non-Goals:** a Codex status line in the terminal; credits / plan type; showing the cumulative token total.

## Decisions

- **Parsed in `codex-format.ts`, delivered as transcript meta.** The rollout format stays in its one module. `TranscriptMetaUpdate` gains `status?: Partial<SessionStatus>` and `limits?: { fiveHour, sevenDay }`; the transcript feature's `onMeta` merges `status` into the session's current status (a `turn_context` only knows the model, a `token_count` only the context) and keeps `updatedAt`, as the status line does.
- **Initial status from the summary.** `extractCodexMeta` already scans the rollout's head and tail; it now also returns the latest model/effort and context/limits it saw. `TranscriptSummary` gains optional `status` / `limits`, applied on `SessionStart`, on restore and on the recent-transcripts scan, so the status bar is filled before the transcript is followed.
- **Limits through the bus.** The transcript and sessions features must not import the status line feature. A new `account.limits` event (`{ profileId, fiveHour, sevenDay }`) is emitted with the session's profile; `StatusLineService` listens and reuses its per-profile dedupe and `limits.updated` broadcast (and the replay on connect). The recent scan does not report limits (an old rollout could overwrite fresher numbers); live sessions do.
- **Context like the Codex TUI.** Codex shows "% context left" from `last_token_usage.total_tokens` with a 12 000-token baseline excluded from both sides: `percent = clamp((tokens − 12000) / (window − 12000) × 100, 0, 100)`. `usedTokens` is the raw `total_tokens`, `size` the window. Without `last_token_usage` (older versions) `total_token_usage` is used. A window of 12 000 or less gives no context item.
- **Window slots by length.** `window_minutes ≤ 1440` → `fiveHour`, longer → `sevenDay`; without a length, primary → `fiveHour`, secondary → `sevenDay`; the first window to claim a slot keeps it. `resetsAt` = `resets_at × 1000`, else the line's timestamp + `resets_in_seconds × 1000`; no reset time → the window is dropped (the app hides windows without a future reset).

## Risks / Trade-offs

- [The rollout format changes between Codex versions] → every field is optional and validated; unknown shapes yield no update rather than zeros.
- [The context formula may drift from the TUI's] → the baseline is a named constant next to the parser, covered by tests.
