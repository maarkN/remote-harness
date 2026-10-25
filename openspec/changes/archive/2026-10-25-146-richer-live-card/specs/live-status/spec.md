## MODIFIED Requirements

### Requirement: Live status content
The live status SHALL show, on the iOS lock screen: the app mark as the only icon; `<profile> · <machine>` (the computer's host name, falling back to the profile name); a state pill with the state name in the state color; the session name; the session folder (home shortened to `~`); a large tabular timer of the time in the current state in the state color (working: the turn; waiting: the wait; done: the turn's total, frozen) with a small label ("working", "waiting", "total"); on the right, "notified … ago" (the time since the daemon sent that update, counting by itself) and, while waiting, the turn's working time; once done, "finished … ago" instead; a "what it's doing now" line with a translated phrase the daemon picks from a fixed table (see below), or the current task when the user opted in; a row with the glyphs of the last five step categories (`⌘` command, `✎` edit, `⌕` search, `⇄` web, `⌥` subagent, `?` permission, `·` other), the current one in the state color; a line with the current step (the tool and its short target, e.g. `Bash · pnpm test`, `Edit · app.ts`) next to the task progress (`☑ 3/7`) when the session has a todo list, the running subagents and background tasks as separate translated counts ("2 subagents · 1 background task") and the tool count; and, only while working with a todo list, a determinate bar of that progress. The live status MUST NOT show an indeterminate progress indicator (widgets don't animate it). Color MUST encode only the state (working = accent, waiting = warning, done = success, closed = muted text), on the border, the timer, the state line, the progress bar and the current glyph, with the colors coming from the `palette` in the props and falling back to the dark theme values. While a tool permission waits, the banner SHALL show Deny and Allow buttons that answer it (see Live status updates) and an Open button that opens the session. When the turn is done, the timer MUST freeze at the turn's duration with the "total" label and the phrase line reads "Finished"; when the session closed, the banner stays muted with the hint that the transcript is kept. In the Dynamic Island the compact view SHALL show the mark and the timer (or the current glyph), the minimal view the mark and a state dot, and the expanded view the lock screen content. Tapping it MUST open the session. Push payloads for the live status MAY contain the session title, its working directory and the current step's tool with a target sanitized by the daemon from a fixed table (a file's base name, a command's program and, for a short list of programs, its subcommand, a URL's host name, a subagent type; nothing for any other tool), and MUST NOT contain any other session content, except the current task below: only the profile and host names, the state, step categories from a fixed table derived from the tool name (with the tool name), glyphs, the tool and task counts, the todo progress counts, the pending request id and tool name with the button labels, timestamps, the session's deep link, the phrase and the translated labels, and the palette.

The phrase SHALL come from a fixed table the daemon applies to signals it already has (the tool name, a file's extension or a directory name, a command's program and subcommand, a URL's host), and only the phrase leaves the daemon: Reading docs… (Read of Markdown or text files or under `docs/`, WebFetch of a docs host), Exploring the code… (Read, Grep, Glob otherwise), Updating scripts… (Edit / Write of shell scripts, under `scripts/`, a Makefile), Editing code… (Edit / Write otherwise), Creating a PDF… (Write of a `.pdf`, a PDF tool in Bash), Committing and pushing… (`git commit`, `git push`, `gh pr`), Running tests…, Building…, Installing dependencies…, Running commands… (other commands), Researching on the web… (WebSearch, other WebFetch), Delegating to N agents… (Task / Agent, N the running subagents, at least 1), Planning… (todo list tools), Thinking…, Writing the answer…, Using tools… (any other tool).

The setting **Show the current task on the lock screen** (Settings → Notifications, under Live status) SHALL be off by default and kept per phone. When on, and only while working or waiting, the payload SHALL also carry the in-progress todo item's present-tense form (from `TodoWrite`, or `TaskCreate` / `TaskUpdate`) on one line, clipped to 48 characters, and the card shows it instead of the phrase. Settings and the privacy policy SHALL explain that this sends text from the session through push.

Texts SHALL be translated (pt-BR, en-US, es-ES). On Android the notification title SHALL carry the session and the state, and the body the task or phrase, the current step (or the step category when there is none), the progress, the subagent and background task counts, the tool count and the glyph row; while a permission waits it SHALL have Allow, Deny and Open actions.

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
- **THEN** the timer shows 4 minutes with the "total" label and stops counting, the line reads "Finished" with "finished … ago" counting, and the colors turn to the done color

#### Scenario: Waiting shows the wait and the work
- **WHEN** a session worked for 14 minutes and has been waiting for a permission for 2 minutes
- **THEN** the big timer shows about 2:00 labelled "waiting", the side shows "working 14:00" and "notified … ago", and Deny, Allow and Open are visible

#### Scenario: Phrase from a fixed table
- **WHEN** Claude Code runs `pnpm vitest run src/login.test.ts` in Bash
- **THEN** the card shows "Running tests…", and neither the arguments nor the file name of the command are sent

#### Scenario: Current task off by default
- **WHEN** the session's todo list has "Implementing the login screen" in progress and the setting is off
- **THEN** the payload carries no task and the card shows the phrase

#### Scenario: Current task on
- **WHEN** the user turned on Show the current task on the lock screen and the in-progress todo reads "Implementing the login screen with the new rate limit rules"
- **THEN** the card shows the first 48 characters of it, ending with an ellipsis

#### Scenario: Older payload
- **WHEN** the widget receives props without the new fields (older daemon)
- **THEN** it renders with the profile name as header and no session, folder, steps, current step, progress, glyphs, labels, phrase or buttons, in the dark colors

#### Scenario: Theme palette
- **WHEN** the app starts a live status while rendering the dark theme
- **THEN** the banner background is `#0D0D0D` and the working color is the amber accent

#### Scenario: Tasks in parallel
- **WHEN** a working session has one background task and two running subagents
- **THEN** its single live status shows "2 subagents · 1 background task", and nothing else about those tasks

### Requirement: Live status protocol
The protocol SHALL have `live.register { sessionId, platform, fcmToken, activityToken?, relay?, palette?, showTask? }` (replies `ack`, replacing an earlier registration of the same session) and `live.unregister { sessionId }` (replies `ack`). `palette` carries the app theme colors used by the live status (`background`, `text`, `textMuted`, `accent`, `success`, `warning`); the daemon SHALL keep it with the registration and include it as `palette` in the props of every update it sends for that registration. The props SHALL also carry `glyphs` (newest first, at most five), `pending` (`{ requestId, tool, allow, deny }` or `null`), `hint`, `tasks` (the translated counts of running subagents and background tasks, empty when none), `current` (the current step's tool and sanitized target, empty when none) `progress` (`{ done, total }` of the todo list, or `null`), `activity` (the translated phrase, empty when none), `task` (the opted-in current task, empty otherwise), `notifiedAt` (when the update was sent, epoch milliseconds, 0 when unknown), `link` (the session's deep link, empty when unknown) and `labels` (`{ working, waiting, total, notified, finished, open }` translated, or `null`), all with defaults so older daemons and apps interoperate. A worst-case update MUST stay under the APNs 4 KB payload limit. `showTask` (also in the follow device) turns the current task on for that phone; a registration without `palette` or `showTask` SHALL keep the values the session's registration already had. Registrations MAY be kept in memory only.

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

#### Scenario: Older app without showTask
- **WHEN** an app that does not know the setting registers a live status
- **THEN** no task is sent and the props carry the phrase only
