## MODIFIED Requirements

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
