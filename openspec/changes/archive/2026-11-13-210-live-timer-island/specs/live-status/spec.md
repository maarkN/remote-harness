## MODIFIED Requirements

### Requirement: Live status content
The live status SHALL show, on the iOS lock screen: the badge of the session's agent (its fixed color with its icon, as the session list draws it) as the only icon, or the app mark when the daemon sends no agent; `<profile> · <machine>` (the computer's host name, falling back to the profile name); a state pill with the state name in the state color; the session name; the session folder (home shortened to `~`); while working or waiting, a large tabular timer of the time in the current state in the state color (working: the turn; waiting: the wait), always in digits (`m:ss`, `h:mm:ss` past an hour) and never truncated, with a small label ("working", "waiting"); on the right, "notified … ago" (the time since the daemon sent that update, counting by itself) and, while waiting, the turn's working time; once done, "finished … ago" instead; a "what it's doing now" line with a translated phrase the daemon picks from a fixed table (see below), or the current task when the user opted in; a row with the glyphs of the last five step categories (`⌘` command, `✎` edit, `⌕` search, `⇄` web, `⌥` subagent, `?` permission, `·` other), the current one in the state color; a line with the current step (the tool and its short target, e.g. `Bash · pnpm test`, `Edit · app.ts`) next to the task progress (`☑ 3/7`) when the session has a todo list, the running subagents and background tasks as separate translated counts ("2 subagents · 1 background task") and the tool count; and, only while working with a todo list, a determinate bar of that progress. The live status MUST NOT show an indeterminate progress indicator (widgets don't animate it). Color MUST encode only the state (working = accent, waiting = warning, done = success, closed = muted text), on the border, the timer, the state line, the progress bar and the current glyph, with the colors coming from the `palette` in the props and falling back to the dark theme values; the agent badge keeps the agent's fixed color. While a tool permission waits, the banner SHALL show Deny and Allow buttons that answer it (see Live status updates) and an Open button that opens the session. When the turn is done, the phrase line reads "Finished after X", X being the turn's duration in words (seconds under a minute, else minutes, with hours past an hour), and takes the place of the timer, with "finished … ago" beside it; when the session closed, the timer freezes at the turn's duration with the "total" label and the banner stays muted with the hint that the transcript is kept. The lock screen card and the expanded Dynamic Island MUST fit the height iOS gives a Live Activity in every state (working, waiting, done, closed), on the smallest supported iPhone and on iPad and in the three languages, with the header row and, while waiting, the Deny and Allow buttons fully visible and tappable. To fit, the lock screen card SHALL lay its content out as: the header row (badge, session name, state pill); one line with `<profile> · <machine>` and the folder; the times row; while working, the "what it's doing now" line with the glyph row beside it; the current step and counts line; and last, while working with a todo list the progress bar, while waiting the buttons, once closed the hint. While waiting the card SHALL leave out the "what it's doing now" line and the glyph row (the state pill and the current step say what waits). Without a session name the header row SHALL show `<profile> · <machine>` in its place. In the Dynamic Island the compact view SHALL show the agent badge (or the mark) and the timer (or the current glyph), the minimal view the badge (or the mark) and a state dot, and the expanded view the badge, `<profile> · <machine>` and the timer on top and, below, the session name, the state pill (with the glyph row beside it, or while waiting the current step), then while waiting the Deny and Allow buttons, otherwise the "what it's doing now" line and the current step and counts line (once closed, the hint); the expanded view leaves out the folder and the progress bar (the `☑` count stays in the counts). Every text of the expanded view MUST stay inside the island, clear of its rounded corners and its bottom edge. Tapping it MUST open the session. Push payloads for the live status MAY contain the session title, its working directory and the current step's tool with a target sanitized by the daemon from a fixed table (a file's base name, a command's program and, for a short list of programs, its subcommand, a URL's host name, a subagent type; nothing for any other tool), and MUST NOT contain any other session content, except the current task below: only the profile and host names, the agent id, the state, step categories from a fixed table derived from the tool name (with the tool name), glyphs, the tool and task counts, the todo progress counts, the pending request id and tool name with the button labels, timestamps, the session's deep link, the phrase and the translated labels, and the palette.

The phrase SHALL come from a fixed table the daemon applies to signals it already has (the tool name, a file's extension or a directory name, a command's program and subcommand, a URL's host), and only the phrase leaves the daemon: Reading docs… (Read of Markdown or text files or under `docs/`, WebFetch of a docs host), Exploring the code… (Read, Grep, Glob otherwise), Updating scripts… (Edit / Write of shell scripts, under `scripts/`, a Makefile), Editing code… (Edit / Write otherwise), Creating a PDF… (Write of a `.pdf`, a PDF tool in Bash), Committing and pushing… (`git commit`, `git push`, `gh pr`), Running tests…, Building…, Installing dependencies…, Running commands… (other commands), Researching on the web… (WebSearch, other WebFetch), Delegating to N agents… (Task / Agent, N the running subagents, at least 1), Planning… (todo list tools), Thinking…, Writing the answer…, Using tools… (any other tool); and, once the turn is done, Finished after X (the turn's duration). The app's own updates (without the daemon's steps) SHALL use the same done phrase from the app's catalog.

The setting **Show the current task on the lock screen** (Settings → Notifications, under Live status) SHALL be off by default and kept per phone. When on, and only while working or waiting, the payload SHALL also carry the in-progress todo item's present-tense form (from `TodoWrite`, or `TaskCreate` / `TaskUpdate`) on one line, clipped to 48 characters, and the card shows it instead of the phrase. Settings and the privacy policy SHALL explain that this sends text from the session through push.

Texts SHALL be translated (pt-BR, en-US, es-ES). On Android the notification title SHALL carry the agent's name (when the props have one), the session and the state, and the body the task or phrase, the current step (or the step category when there is none), the progress, the subagent and background task counts, the tool count and the glyph row; while a permission waits it SHALL have Allow, Deny and Open actions.

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
- **THEN** the card reads "Finished after 4 min" where the timer was, with "finished … ago" counting beside it, and the colors turn to the done color

#### Scenario: Short turn
- **WHEN** a turn that started 40 seconds ago finishes
- **THEN** the card reads "Finished after 40 s"

#### Scenario: Agent on the card
- **WHEN** a Codex session is working
- **THEN** the card, the compact and minimal Dynamic Island views show the Codex badge instead of the app mark, and the Android notification title starts with "Codex"

#### Scenario: Older daemon without an agent
- **WHEN** the props carry no agent
- **THEN** the card shows the app mark and the Android title has no agent name

#### Scenario: Waiting card fits the lock screen
- **WHEN** a session with a long title, a todo list, a subagent and six tools waits for a Bash permission, on an iPhone SE and on an iPad, in pt-BR
- **THEN** the lock screen card shows the header row with the state pill, the profile, computer and folder line, the times, `Bash · pnpm` with the counts and the Deny, Allow and Open buttons, all inside the card and tappable, with no row clipped at the top or the bottom

#### Scenario: Working card fits the lock screen
- **WHEN** a working session has a todo list at 3/5 and the phrase "Running tests…"
- **THEN** the lock screen card shows the header row, the profile line, the times, the phrase with the glyph row beside it, the current step with the counts and the progress bar, with no row clipped

#### Scenario: Timer in digits
- **WHEN** a session has been working for 6 minutes 12 seconds, with the phone in pt-BR, en-US or es-ES
- **THEN** the lock screen card's timer reads `6:12`, with no words and no ellipsis, and a turn past an hour reads `1:02:07`

#### Scenario: Expanded Dynamic Island edges
- **WHEN** the user long-presses the Dynamic Island of a working, waiting or done session
- **THEN** every row of the expanded view, the last one included, is fully inside the island, none cut by the rounded corners or the bottom edge

#### Scenario: Expanded Dynamic Island while waiting
- **WHEN** the user long-presses the Dynamic Island of a session waiting for a permission
- **THEN** the expanded view shows the session name, the waiting pill with the current step and the Deny and Allow buttons, fully visible and tappable

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
