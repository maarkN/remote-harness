# session-registry Specification

## Purpose
Maintains the unified list of Claude Code sessions across all profiles, with their state and whether they can be controlled.

## Requirements

### Requirement: Unified listing
The daemon SHALL answer `sessions.list` with all active sessions (linked to a live tmux pane) and recent ones (transcripts modified in the last 7 days) from all profiles, each with `id`, `profileId`, `cwd`, `title`, `state`, `permissionMode`, `controllable`, `updatedAt`.

#### Scenario: Two profiles
- **WHEN** there is an active session in `claudin` and another in `drclaude`
- **THEN** the snapshot contains both, each with its own `profileId`

#### Scenario: Disk-only session
- **WHEN** a recent transcript has no linked tmux pane
- **THEN** the session appears with `controllable: false` and state `ended`

### Requirement: Event-driven state
The daemon SHALL update the session state from the hooks: `SessionStart` → `idle`; `UserPromptSubmit` → `running`; `Stop` → `idle`, except that a Claude Code `Stop` whose `background_tasks` still lists agent work in flight (an item of type `subagent` or `workflow` whose `status` is not final: `completed`, `failed`, `killed`, `cancelled`, `stopped`) keeps the session `running` until a `Stop` with no agent work in flight (background `shell` and `monitor` items, and unknown types, do not hold the session); `Notification`/`PermissionRequest` → `waiting`; `SessionEnd` → `ended`; `Interrupt` (Codex only, no Claude Code equivalent) → `idle`. Once a session is `ended` (by `SessionEnd`, a dead pane, a close, being replaced in its pane or a resume whose pane closed), only `SessionStart` or a `UserPromptSubmit` from a tmux pane MAY change its state, pane or controllability; later hooks MUST NOT move it back to `waiting`, `running` or `idle`. A resolved permission request SHALL set `running` only on a session that is not `ended`. When a session becomes `ended`, its pending permission requests MUST be cancelled, its live status MUST end, and hooks that arrive later MUST NOT send pushes or live status updates. Each change MUST be sent to clients: as `session.updated` with the full session the first time a session appears, then as `session.changed { sessionId, set, unset }` with only the fields whose value changed (`unset` lists the fields that became absent).

#### Scenario: Permission request
- **WHEN** a `Notification` of type `permission_prompt` arrives
- **THEN** the session becomes `waiting` and clients receive `session.changed` with `state: waiting`

#### Scenario: Late notification after /exit
- **WHEN** a session got `SessionEnd` and then an idle `Notification` from the same pane arrives
- **THEN** the session stays `ended` and read-only, and no "waiting" push is sent

#### Scenario: /exit with a pending permission
- **WHEN** a session has a pending permission request and ends
- **THEN** the request is cancelled, its resolution does not set the session `running`, and the session stays `ended`

#### Scenario: Pane gone while waiting
- **WHEN** a waiting session's pane disappears
- **THEN** the session becomes `ended` and leaves the waiting state

#### Scenario: Resumed
- **WHEN** an ended session is resumed and its `SessionStart` arrives from the new pane
- **THEN** the session becomes `idle` and controllable again

#### Scenario: Codex turn interrupted
- **WHEN** a Codex session is `running` and its `Interrupt` hook arrives (the turn paused instead of finishing, e.g. to ask the user a question)
- **THEN** the session becomes `idle`, so a prompt sent with `mode: auto` or already queued is delivered right away instead of waiting on a `Stop` that never comes

#### Scenario: Status line tick
- **WHEN** only the status line of a session changes
- **THEN** clients receive a `session.changed` carrying only `status`

#### Scenario: Workflow still running after the turn
- **WHEN** a session's `Stop` arrives with `background_tasks` listing a `workflow` item with status `running`
- **THEN** the session stays `running`, with the background badge

#### Scenario: Workflow finished
- **WHEN** that workflow ends, Claude Code wakes the session with its notification, and the wake-up turn's `Stop` arrives with no agent work in `background_tasks`
- **THEN** the session becomes `idle`

#### Scenario: Background shell only
- **WHEN** a session's `Stop` arrives with `background_tasks` listing only a running `shell` item (e.g. a dev server)
- **THEN** the session becomes `idle`

### Requirement: Dead pane
The daemon SHALL periodically check (every 5 s) whether the linked panes exist and MUST mark sessions whose pane is gone as `ended` and `controllable: false`.

#### Scenario: tmux window closed
- **WHEN** the user closes the session's window on the Mac
- **THEN** within 5 s the session appears as ended in the app

### Requirement: Link persistence
The session ↔ pane ↔ profile link SHALL be persisted with the session's `updatedAt` and restored when the daemon starts, discarding panes that no longer exist. A restored session SHALL keep its persisted `updatedAt`; when the state file predates the field, the transcript's modification time is used, and only without a transcript the restore time.

#### Scenario: Daemon restart
- **WHEN** the daemon restarts with a session still open in tmux
- **THEN** the session appears as controllable again

#### Scenario: Restart does not reorder
- **WHEN** two sessions with different `updatedAt` are restored after a restart
- **THEN** both keep their `updatedAt` and their relative order

### Requirement: Session checkout
Each session SHALL carry `checkout: { root, branch } | null`: the root of the git worktree that contains its `cwd` and the current branch (`null` when detached), or `null` when the `cwd` is not inside a git checkout or no longer exists. The daemon SHALL resolve it when a session appears, when its `cwd` changes and when a turn starts, and SHALL broadcast `session.updated` only when it changes. Git MUST be called only from `infra/`.

#### Scenario: Session in a repository
- **WHEN** a session reports `cwd` `~/work/api/src` and `~/work/api` is a git repository on `main`
- **THEN** the session has `checkout` `{ root: "~/work/api", branch: "main" }` (absolute paths)

#### Scenario: Worktree of the same repository
- **WHEN** another session runs in `~/work/api/.claude/worktrees/remote-1`
- **THEN** its `checkout.root` is the worktree directory, different from the main checkout

#### Scenario: Not a repository
- **WHEN** the `cwd` is not inside a git checkout
- **THEN** `checkout` is `null`

### Requirement: Last activity
A session's `updatedAt` SHALL mean its last real activity: a hook event (prompt, stop, permission, notification, session start or end, subagent stop) or new transcript entries read by the daemon for the session or one of its subagents. Transcript activity SHALL advance `updatedAt` at most once every 5 seconds per session. Metadata refreshes (status line, checkout) MUST NOT advance it. A patch that only carries a newer `updatedAt` SHALL count as a change and be broadcast as `session.updated`.

#### Scenario: Streaming output
- **WHEN** a followed session appends transcript lines continuously for 12 seconds
- **THEN** its `updatedAt` advances at most three times and each advance is broadcast

#### Scenario: Status tick
- **WHEN** only the session's status line changes
- **THEN** `updatedAt` is unchanged

### Requirement: Session agent
Every session SHALL carry the `agent` of its profile (`claude` for profiles without one), set when the record is created from a hook or from the recent-transcript scan and sent to clients in `sessions.snapshot` and `session.updated`. Clients MUST treat a missing `agent` as Claude Code. The daemon SHALL build agent-specific launch arguments (resume, worktree) and find transcripts through the profile's agent adapter, so Claude Code sessions behave exactly as before this requirement.

#### Scenario: Session from a hook
- **WHEN** `SessionStart` arrives for the profile `claudin` (no `agent` in its config)
- **THEN** the session is listed with `agent: "claude"`

#### Scenario: Older daemon
- **WHEN** the app receives a session without `agent`
- **THEN** it shows the Claude Code badge and names Claude Code in the copy

### Requirement: Prompt-derived title
A Claude Code session's title SHALL be, in order: the latest name given with `/rename` (or from the app), else its first prompt, else its last prompt, else the folder name. While the title is still the folder name, or is raw markup left by older daemons, each prompt SHALL set it. A title taken from a prompt MUST NOT show markup: harness context (system reminders, command output) is ignored; text pasted into the prompt is replaced by the user's own words around it, or by the first line of the pasted text when there are none; a slash command gives the command and its arguments. A plain prompt SHALL win over a slash command as the first prompt. A prompt with nothing left SHALL leave the title as it was.

#### Scenario: Pasted prompt with the user's words
- **WHEN** the first prompt is "Summarize this" followed by a pasted block
- **THEN** the session is titled "Summarize this"

#### Scenario: Only pasted text
- **WHEN** the first prompt is only a pasted block whose first line is "Error: connection refused"
- **THEN** the session is titled "Error: connection refused"

#### Scenario: Slash command
- **WHEN** the first prompt is the `/review` command with the argument `123`
- **THEN** the session is titled "/review 123"

#### Scenario: Raw tag from an older daemon
- **WHEN** a session is titled with a raw `<pasted_content …>` tag and the user sends another prompt
- **THEN** the title is replaced by the title of that prompt

#### Scenario: Name wins
- **WHEN** a session was renamed with `/rename` and the user pastes a prompt
- **THEN** the session keeps its name

### Requirement: Last activity preview
Each session SHALL carry `lastActivity`: the last prompt (`user`, including a slash command), reply (`assistant`) or tool call (`tool`, the tool name with a short target such as the file name or the command's first line) of its own transcript, ignoring subagents, thinking, tool results and system lines, with its timestamp (`at`), or `null` when none is known. The text SHALL be one line of plain text (markdown markers and line breaks removed) of at most 200 characters, ending in `…` when cut. The daemon SHALL read it from the tail of the transcript through the agent's transcript format, when the session is registered (live or read-only from the recent scan) and whenever it shows activity (a hook event or a new `updatedAt`), at most once every 3 seconds per session, with a trailing refresh so the last change of a burst is not lost. Refreshing it MUST NOT advance `updatedAt`. It SHALL only be sent in session messages over the authenticated connection and MUST NOT appear in push payloads. Older daemons omit it, which the app reads as `null`.

#### Scenario: Reply after a turn
- **WHEN** a session's turn ends with the reply "I raised the **pool** to 20."
- **THEN** within 3 seconds its `lastActivity` is `{ kind: "assistant", text: "I raised the pool to 20.", at: <the entry's timestamp> }` and its `updatedAt` is unchanged by the refresh

#### Scenario: Running tool
- **WHEN** the last entry of a running session is the result of an `Edit` of `src/db/pool.ts`
- **THEN** its `lastActivity` is a `tool` with the text `Edit(pool.ts)`

#### Scenario: Long prompt
- **WHEN** the last prompt has 900 characters over several lines
- **THEN** `lastActivity.text` is a single line of 200 characters ending in `…`

#### Scenario: Streaming burst
- **WHEN** a session writes transcript lines continuously for 10 seconds
- **THEN** its `lastActivity` is refreshed at most five times and the last refresh reflects the last entry

#### Scenario: Push stays content-free
- **WHEN** a session with a `lastActivity` asks for a permission and a push is sent
- **THEN** the push payload carries none of the `lastActivity` text
