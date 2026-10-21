## ADDED Requirements

### Requirement: Codex session status
The daemon SHALL derive a Codex session's status from its rollout and send it through the same fields as Claude Code's status line: the model and reasoning effort from the latest `turn_context`, and the context usage from the latest `token_count` event (`last_token_usage.total_tokens`, or `total_token_usage` when absent, against `model_context_window`, with the Codex TUI's 12 000-token baseline excluded from the percentage) as `Session.status`, without changing the session's `updatedAt`; and the account's rate limits (`rate_limits.primary` / `secondary`) as `limits.updated` for the session's profile, a window of up to one day in the 5-hour slot and a longer one in the 7-day slot (primary and secondary respectively when the length is missing), with the reset time from `resets_at` or `resets_in_seconds`. The status MUST be known when the session is registered and MUST follow new lines while the transcript is read. Items a rollout does not carry (older Codex versions, `info` or `rate_limits` `null`) MUST stay unknown, never zero. Claude Code sessions MUST be unaffected.

#### Scenario: Model and effort
- **WHEN** a Codex rollout's latest `turn_context` has model `gpt-5.5-codex` and effort `medium`
- **THEN** the session's status has model `gpt-5.5-codex` and effort `medium`

#### Scenario: Context usage
- **WHEN** a `token_count` event reports `last_token_usage.total_tokens` 72 000 of a 272 000-token window
- **THEN** the session's status has `context` `{ usedTokens: 72000, size: 272000, percent: 23.08 }` (rounded by the app to 23%)

#### Scenario: Rate limits
- **WHEN** a `token_count` event has `primary` `{ used_percent: 12, window_minutes: 300, resets_at: T }` and `secondary` `{ used_percent: 40, window_minutes: 10080, resets_at: U }`
- **THEN** clients receive `limits.updated` for the session's profile with `fiveHour` `{ percent: 12, resetsAt: T × 1000 }` and `sevenDay` `{ percent: 40, resetsAt: U × 1000 }`

#### Scenario: API key account
- **WHEN** every `token_count` event has `rate_limits: null`
- **THEN** the profile's limits stay unknown and only the model and context are shown

#### Scenario: Older rollout
- **WHEN** a rollout has no `token_count` events
- **THEN** the context item stays unknown and the app does not show it
