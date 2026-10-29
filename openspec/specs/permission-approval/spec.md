# permission-approval Specification

## Purpose
Allows approving or denying the sessions' permission requests from the phone, including creating "always allow" rules.

## Requirements

### Requirement: Request brokering
On receiving `PermissionRequest`, the daemon SHALL create a request with a `requestId`, send `permission.request { requestId, sessionId, tool, input, suggestedRule, expiresAt }` to the clients and keep the hook request open until the response or the timeout.

#### Scenario: Approval
- **WHEN** the app replies `permission.respond` with `allow`
- **THEN** the hook receives `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` and the tool runs

#### Scenario: Denial
- **WHEN** the app replies `deny`
- **THEN** the hook receives `behavior: "deny"` with the message "Denied by Remote Harness"

### Requirement: Timeout without decision
If no response arrives before the configured limit (lower than the hook timeout), the daemon SHALL answer the hook without a decision and hand the request over to the terminal instead of resolving it. The limit SHALL be `questionTimeoutSec` (default 3300) for interactive requests (questions and plan approvals) and `permissionTimeoutSec` (default 280) for the others. The daemon MUST log the handover with the tool name only.

#### Scenario: Phone does not respond
- **WHEN** the timeout of a tool permission expires
- **THEN** the permission dialog stays in the TUI, the clients receive the request again with `terminal: true`, and no `permission.resolved` is sent yet

#### Scenario: Question left for ten minutes
- **WHEN** an `AskUserQuestion` request has waited ten minutes
- **THEN** it is still pending without `terminal`, and answering it from the app answers the hook

### Requirement: Single response
Only the first response for a `requestId` SHALL count; subsequent ones MUST receive `error` `already_resolved`.

#### Scenario: Two responses
- **WHEN** the app answers the same request twice
- **THEN** the second one receives `already_resolved`

### Requirement: Always allow
With `always { rule, scope }`, the daemon SHALL approve the request and persist the rule in `permissions.allow`: scope `profile` in the profile's `settings.json`; scope `project` in the `.claude/settings.local.json` of the session's `cwd`. The rest of the file MUST be preserved and the rule recorded in the daemon's rules log, so any device or the CLI can undo it. Undoing removes the rule from the file it was written to by read → merge → backup next to the file (`<file>.bak-claude-remote`) → atomic write, and is idempotent.

#### Scenario: Project rule
- **WHEN** the app approves with `always { rule: "Bash(pnpm test:*)", scope: "project" }`
- **THEN** the project's `.claude/settings.local.json` now contains the rule and the next `pnpm test` does not ask for permission

#### Scenario: Undo
- **WHEN** the user runs `remote-harness rules undo <id>` or a device sends `rules.undo { ruleId }`
- **THEN** the rule is removed from the file it was written to, a backup of the previous file sits next to it, and the other keys of the file are unchanged

#### Scenario: Undo of a rule already gone
- **WHEN** the rule of a `rules.undo` is no longer in its file
- **THEN** the file is not written and the daemon answers `ack`

### Requirement: Request closed by the TUI
When Claude Code closes the hook request without the app's response, the daemon SHALL wait a short grace period (3 seconds). If the session moved on by then (a tool result or user message in the transcript, or a turn hook), the request SHALL be resolved as `cancelled`; otherwise it SHALL be handed over to the terminal like an expired one, because Claude Code's dialog may still be open.

#### Scenario: Approved on the Mac
- **WHEN** the user answers in the terminal and the transcript gets the tool result within the grace period
- **THEN** the clients receive `permission.resolved` with `cancelled` and never see the request handed over

#### Scenario: Hook closed while the dialog stays open
- **WHEN** Claude Code closes the hook (its own timeout) and nothing moves in the session for 3 seconds
- **THEN** the clients receive the request again with `terminal: true`

### Requirement: Interactive tool requests
When the `PermissionRequest` tool is `AskUserQuestion` or `ExitPlanMode` and its input is well formed, the daemon SHALL include `interaction` in `permission.request`: for questions, the optional title and each question with its text, header, kind (`choice`, `text` or `number`), options (label and description) and `multiSelect`; for a plan, the plan text. Malformed input MUST produce no `interaction`.

#### Scenario: Multiple-choice question
- **WHEN** `AskUserQuestion` arrives with one question and three options
- **THEN** `permission.request` carries `interaction.kind: "question"` with the question and the three options

#### Scenario: Malformed input
- **WHEN** `AskUserQuestion` arrives without `questions`
- **THEN** `permission.request` has no `interaction`

### Requirement: Structured answers
The daemon SHALL accept `permission.answer` for a pending interactive request and answer the hook: a question answer becomes `allow` with `updatedInput` equal to the original input plus `answers` (question text → answer); a plan approval becomes `allow` with `updatedPermissions` `setMode` (`acceptEdits` or `default`, destination `session`); "keep planning" becomes `deny` with the user's feedback or a localized default message. An answer whose kind does not match the request, or `permission.respond` `allow` on an interactive request, MUST be rejected with `bad_request`.

#### Scenario: Question answered on the phone
- **WHEN** the app sends `permission.answer` with `{"Which database?": "Postgres"}`
- **THEN** the hook receives `behavior: "allow"` and `updatedInput.answers` with that answer, and clients receive `permission.resolved` `allowed`

#### Scenario: Keep planning
- **WHEN** the app sends a plan answer `keepPlanning` with the feedback "split step 2"
- **THEN** the hook receives `behavior: "deny"` with the message "split step 2"

#### Scenario: Answered in the terminal
- **WHEN** the user answers the question on the computer while the phone shows it
- **THEN** Claude Code closes the hook request and clients receive `permission.resolved` `cancelled`

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

### Requirement: Question reminder
When an interactive request (question or plan) is still open `10` minutes after it was created, and its timeout is longer than that, the daemon SHALL send one reminder push for it, handed over or not.

#### Scenario: Unanswered question
- **WHEN** a question is still open after ten minutes
- **THEN** one reminder push is sent, and none after an answer

### Requirement: Project rules approved in a worktree session
When an "always allow" rule with scope `project` is approved for a session whose directory is a Claude Code worktree root (`<root>/.claude/worktrees/<name>`), the daemon SHALL record the rule against `<root>/.claude/settings.local.json`, the file Claude Code writes for worktrees, so that `remote-harness rules undo` removes it from there. Other directories keep `<cwd>/.claude/settings.local.json`.

#### Scenario: Rule approved in a worktree session
- **WHEN** the phone approves `Bash(pnpm test:*)` with scope `project` for a session in `~/work/api/.claude/worktrees/login`
- **THEN** the rules log names `~/work/api/.claude/settings.local.json`

### Requirement: Pending requests after a reconnect
The daemon SHALL send every pending request to a client right after it accepts the connection, and SHALL answer `permissions.list` with `permissions.result { requests }` listing every request waiting at that moment. On every ready connection, and when its permission store is bound to a connection that is already open, the app SHALL ask for `permissions.list` and replace its pending requests with the reply, so a cold start or a reconnect shows every waiting request in the "Waiting for you" strip, the row's badge and the session screen, answerable. Whether the replay arrives before the app sees the connection as ready MUST NOT matter, and a request seen again MUST NOT repeat the new-request haptic. With a daemon that has no `permissions.list`, the app SHALL keep, after a reconnect, the requests that connection replayed and drop the others.

#### Scenario: Cold start
- **WHEN** a session waits on a Bash request and the app is relaunched
- **THEN** the strip shows the request with Deny / Always / Allow and the row shows "1 permission"

#### Scenario: Replay before the stores listen
- **WHEN** the connection authenticates and the daemon replays the request before the app binds its permission store
- **THEN** the store, once bound, asks for `permissions.list` and shows the request

#### Scenario: Reconnect after an answer elsewhere
- **WHEN** the app reconnects after one of two pending requests was answered from the tray
- **THEN** only the other request remains, and it does not buzz again

### Requirement: Rule listing
`rules.list` SHALL answer `rules.result` with the `permissions.allow` entries of the `settings.json` of every profile whose agent takes permission rules (scope `profile`) and of the `.claude/settings.local.json` of every project with a known session (scope `project`; a worktree's project rules live in its main checkout's file), grouped by file. Each rule SHALL be marked `app` (an app-created rule: in the rules log and still in its file, with the log ID and creation time) or `hand` (a hand-written rule). Files that do not exist or have no rules are left out.

#### Scenario: Both kinds in one file
- **WHEN** a project's `settings.local.json` holds `Bash(ls:*)` written by hand and `Bash(pnpm test:*)` created from the app
- **THEN** `rules.result` lists that file with scope `project`, `Bash(ls:*)` as `hand` and `Bash(pnpm test:*)` as `app` with its log ID

### Requirement: Rule deletion
`rules.delete { file, rule }` SHALL remove the rule from the file only when the file is one `rules.list` would list; any other path is rejected with `not_found`. The removal follows read → merge → backup next to the file → atomic write and is idempotent (a rule already gone answers `ack` without writing).

#### Scenario: Hand-written rule deleted
- **WHEN** a device sends `rules.delete` for `Bash(ls:*)` of a listed `settings.local.json`
- **THEN** the rule is gone from the file, the previous file is kept as `settings.local.json.bak-claude-remote` and the other keys are unchanged

#### Scenario: Path outside the listing
- **WHEN** a device sends `rules.delete` with `file: "/etc/hosts"`
- **THEN** the daemon answers `not_found` and writes nothing

### Requirement: Approval log
The daemon SHALL append to its approval log every Allow and Deny a device answers (`permission.respond`, and plan approvals through `permission.answer`) and every rule undo or delete, with the time, the action (`allow`, `deny`, `undo`, `delete`; `always` set for an allow that created a rule), the paired device (ID and name; none for the CLI), the session ID and the base name of its folder, the tool, and a short target from the live status table (`stepTarget`: base file name, command program, URL host). The tool input MUST NOT be logged; rule actions carry the rule text, already present in the settings file. Entries older than 30 days SHALL be dropped. `approvals.list` answers `approvals.result` with the entries, most recent first, at most 500; `remote-harness approvals list` prints them.

#### Scenario: Allow from a device
- **WHEN** the device "Pixel 9" allows `Bash` with `git commit -m "secret"` in a session in `~/code/app`
- **THEN** the log gets `allow` with that device, the session, folder `app`, tool `Bash` and target `git commit`, and nothing of the message

#### Scenario: Retention
- **WHEN** the log holds an entry from 31 days ago
- **THEN** `approvals.list` does not return it and the daemon drops it from the file

#### Scenario: Answer in the terminal
- **WHEN** a request is answered in the terminal or expires
- **THEN** nothing is logged

### Requirement: Always only where rules apply
For a permission request with `rules: false` the app SHALL NOT offer the Always action, in the conversation card and in the waiting strip, and the card SHALL show a short translated note that this agent cannot save always-allow rules from the app and the terminal's own "don't ask again" option should be used instead. An `always` sent anyway for such a request MUST be refused with `bad_request`, writing no rule and leaving the request open.

#### Scenario: Codex request
- **WHEN** a permission request with `rules: false` is shown
- **THEN** the card has Deny and Allow only, plus the note about always-allow rules

#### Scenario: Claude Code request
- **WHEN** a permission request with `rules: true` is shown
- **THEN** the card has Deny, Always and Allow as before
