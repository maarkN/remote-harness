## MODIFIED Requirements

### Requirement: Handover to the terminal
A request handed over to the terminal SHALL stay in the daemon's pending list, replayed to clients that connect and counted as pending for its session (queued prompts and mode changes keep waiting). It SHALL end on the first of: a `tool_result` or `user` transcript entry of the session, a `UserPromptSubmit`, `Stop`, `Interrupt` or `SessionEnd` hook of the session, a new `PermissionRequest` of the session, or the session ending. When it ends, the clients receive `permission.resolved` with `expired` (daemon timeout) or `cancelled` (hook closed by Claude Code). `permission.respond` and `permission.answer` on a handed-over request MUST be rejected with `already_resolved`. Closing the session MUST NOT try to deny a handed-over request. Nothing SHALL be answered on the user's behalf.

#### Scenario: Answered in the terminal after the handover
- **WHEN** a question was handed over and the user answers it in the TUI
- **THEN** the transcript gets the tool result and the clients receive `permission.resolved` with `expired`

#### Scenario: Answering a handed-over request from an old app
- **WHEN** an app sends `permission.answer` for a handed-over request
- **THEN** it receives `already_resolved` and the hook is not answered

#### Scenario: Codex turn interrupted during a handover
- **WHEN** a Codex permission request was handed over to the terminal and the session's `Interrupt` hook arrives before the handover's own timeout
- **THEN** the request ends immediately with `permission.resolved` `expired`, instead of staying open until the timeout
