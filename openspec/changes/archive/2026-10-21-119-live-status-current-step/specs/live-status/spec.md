## MODIFIED Requirements

### Requirement: Live status content
The live status SHALL show, on the iOS lock screen: the app mark as the only icon; `<profile> · <machine>` (the computer's host name, falling back to the profile name); the session name; the session folder (home shortened to `~`); a large tabular timer of the turn in the state color; a state line with the state name and the current step category; a row with the glyphs of the last five step categories (`⌘` command, `✎` edit, `⌕` search, `⇄` web, `⌥` subagent, `?` permission, `·` other), the current one in the state color; a line with the current step (the tool and its short target, e.g. `Bash · pnpm test`, `Edit · app.ts`) next to the task progress (`☑ 3/7`) when the session has a todo list, the running subagents and background tasks as separate translated counts ("2 subagents · 1 background task") and the tool count; and, only while working with a todo list, a determinate bar of that progress. The live status MUST NOT show an indeterminate progress indicator (widgets don't animate it). Color MUST encode only the state (working = accent, waiting = warning, done = success, closed = muted text), on the border, the timer, the state line, the progress bar and the current glyph, with the colors coming from the `palette` in the props and falling back to the dark theme values. While a tool permission waits, the banner SHALL show Deny and Allow buttons that answer it (see Live status updates). When the turn is done, the timer MUST freeze at the turn's duration with the "total" hint; when the session closed, the banner stays muted with the hint that the transcript is kept. In the Dynamic Island the compact view SHALL show the mark and the timer (or the current glyph), the minimal view the mark and a state dot, and the expanded view the lock screen content. Tapping it MUST open the session. Push payloads for the live status MAY contain the session title, its working directory and the current step's tool with a target sanitized by the daemon from a fixed table (a file's base name, a command's program and, for a short list of programs, its subcommand, a URL's host name, a subagent type; nothing for any other tool), and MUST NOT contain any other session content: only the profile and host names, the state, step categories from a fixed table derived from the tool name (with the tool name), glyphs, the tool and task counts, the todo progress counts, the pending request id and tool name with the button labels, timestamps and the palette. Texts SHALL be translated (pt-BR, en-US, es-ES). On Android the notification body SHALL carry the current step (or the step category when there is none), the progress, the subagent and background task counts, the tool count and the glyph row.

#### Scenario: Running a command
- **WHEN** Claude Code calls the Bash tool with `pnpm test --filter daemon`
- **THEN** the live status shows `Bash · pnpm test` as the current step, lists "Bash · running a command" among the latest steps, the glyph row gains `⌘` and the tool count increases, and the rest of the command is never sent

#### Scenario: Editing a file
- **WHEN** Claude Code calls Edit on `/Users/me/project/src/app.ts`
- **THEN** the current step is `Edit · app.ts`, without the directories

#### Scenario: Searching
- **WHEN** Claude Code calls Grep with a pattern
- **THEN** the current step is `Grep`, and the pattern is never sent

#### Scenario: Todo progress
- **WHEN** the session's todo list has 7 items, 3 of them completed, while working
- **THEN** the live status shows `☑ 3/7` and a determinate bar at 3/7, and no indeterminate indicator

#### Scenario: Working without a todo list
- **WHEN** a working session has no todo list
- **THEN** the live status shows no progress bar or spinner; the ticking timer and the state line remain

#### Scenario: Waiting for a while
- **WHEN** a session has been waiting for permission for 10 minutes
- **THEN** the border, timer and state line have the waiting color, the state line shows the waiting state, and the Deny / Allow buttons are visible

#### Scenario: Turn finished
- **WHEN** a turn that started 4 minutes ago finishes
- **THEN** the timer shows 4 minutes with the "total" hint and stops counting, and the colors turn to the done color

#### Scenario: Older payload
- **WHEN** the widget receives props without the new fields (older daemon)
- **THEN** it renders with the profile name as header and no session, folder, steps, current step, progress, glyphs or buttons, in the dark colors

#### Scenario: Theme palette
- **WHEN** the app starts a live status while rendering the dark theme
- **THEN** the banner background is `#0D0D0D` and the working color is the amber accent

#### Scenario: Tasks in parallel
- **WHEN** a working session has one background task and two running subagents
- **THEN** its single live status shows "2 subagents · 1 background task", and nothing else about those tasks

### Requirement: Live status updates
The daemon SHALL keep registered live statuses up to date through FCM while the session is registered: `UserPromptSubmit` → working (new start time; an unfinished todo progress carries over, a finished one is dropped), a permission request or a waiting notification → waiting for you (a tool permission also sets `pending` with its request id and tool), the permission resolution → working (pending cleared), transcript tool/thinking/text entries → step, current step, glyph and tool count, `TodoWrite` / `TaskCreate` / `TaskUpdate` entries → todo progress, changes of the session's background tasks or running subagents → their counts, `Stop` → done, `SessionEnd` → closed. State and pending changes MUST be sent immediately; step, current step, progress, tool and task count changes at most every 15 seconds. On `Stop` it MUST update the activity to done (Android: a notification that is not persistent), keep the registration and end the activity 15 minutes later unless a new `UserPromptSubmit` comes first, which MUST turn the same activity back to working. On `SessionEnd` it MUST end it right away. On iOS the update uses the activity push token; on Android a notification with a per-session tag on the low-importance "Live status" channel. The Deny / Allow buttons of the activity SHALL reach the app as interactions whose target names the decision and the request id; the app SHALL answer with `permission.respond` over a short-lived connection, as it does for notification actions.

#### Scenario: Waiting for permission
- **WHEN** a registered session asks for a tool permission
- **THEN** the live status immediately shows "waiting for you" with the Deny / Allow buttons for that request

#### Scenario: Allow from the lock screen
- **WHEN** the user taps Allow on the activity
- **THEN** the app sends `permission.respond` `allow` for the pending request and the status returns to working once the daemon resolves it

#### Scenario: Turn finished
- **WHEN** a registered session fires `Stop`
- **THEN** the live status shows "done" and is dismissed after 15 minutes

#### Scenario: Next prompt within the window
- **WHEN** a registered session fires `Stop` and, 5 minutes later, `UserPromptSubmit`
- **THEN** the same activity shows working again and is not dismissed

#### Scenario: Plan carried to the next turn
- **WHEN** a turn ends with a todo list at 3/7 and the user sends the next prompt
- **THEN** the new turn's live status still shows `☑ 3/7`; a list at 7/7 would not carry over

### Requirement: Live status protocol
The protocol SHALL have `live.register { sessionId, platform, fcmToken, activityToken?, relay?, palette? }` (replies `ack`, replacing an earlier registration of the same session) and `live.unregister { sessionId }` (replies `ack`). `palette` carries the app theme colors used by the live status (`background`, `text`, `textMuted`, `accent`, `success`, `warning`); the daemon SHALL keep it with the registration and include it as `palette` in the props of every update it sends for that registration. The props SHALL also carry `glyphs` (newest first, at most five), `pending` (`{ requestId, tool, allow, deny }` or `null`), `hint`, `tasks` (the translated counts of running subagents and background tasks, empty when none), `current` (the current step's tool and sanitized target, empty when none) and `progress` (`{ done, total }` of the todo list, or `null`), all with defaults so older daemons and apps interoperate. A worst-case update MUST stay under the APNs 4 KB payload limit. Registrations MAY be kept in memory only.

#### Scenario: New activity for the same session
- **WHEN** the app registers a second live status for a session
- **THEN** the daemon keeps only the latest registration

#### Scenario: Palette echoed
- **WHEN** the app registers with a palette and the daemon later sends a "waiting" update
- **THEN** the update's props carry the same palette

#### Scenario: Older app without a palette
- **WHEN** the registration has no palette
- **THEN** the props are sent without one and the widget renders with its dark defaults

#### Scenario: Pending in the props
- **WHEN** a tool permission is pending for a registered session
- **THEN** the props carry `pending` with the request id, the tool name and the translated Allow / Deny labels, and nothing else about the request

#### Scenario: Older daemon without current or progress
- **WHEN** the app parses props without `current` or `progress`
- **THEN** they default to `''` and `null`
