## 1. Parser

- [x] 1.1 `codex-format.ts`: pure `codexLineStatus(line)` reading `turn_context` (model, effort) and `token_count` (context with the 12k baseline, rate-limit windows by length, reset times); `parseCodexMeta` returns `status` / `limits` next to the approval policy.
- [x] 1.2 `extractCodexMeta` returns the latest status and limits seen in the head and tail.
- [x] 1.3 Tests with real-shaped `turn_context` / `token_count` lines (new and old reset fields, `info: null`, `rate_limits: null`, missing window length) and the fixtures.

## 2. Daemon wiring

- [x] 2.1 `TranscriptMetaUpdate` and `TranscriptSummary` gain `status` / `limits`; the Codex summary fills them.
- [x] 2.2 Transcript `onMeta` merges the partial status into the session (keeping `updatedAt`) and emits `account.limits` with the session's profile.
- [x] 2.3 Sessions service applies the summary status on `SessionStart`, restore and the recent scan, and reports limits for live sessions.
- [x] 2.4 `StatusLineService` listens to `account.limits` (dedupe, `limits.updated`, replay on connect); test.

## 3. Verification

- [x] 3.1 `pnpm check` green.
