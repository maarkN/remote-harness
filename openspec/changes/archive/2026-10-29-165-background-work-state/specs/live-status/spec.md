## MODIFIED Requirements

### Requirement: Live status updates
The daemon SHALL keep registered live statuses up to date through FCM while the session is registered: `UserPromptSubmit` → working (new start time; an unfinished todo progress carries over, a finished one is dropped), a permission request or a waiting notification → waiting for you (a tool permission also sets `pending` with its request id and tool), the permission resolution → working (pending cleared), transcript tool/thinking/text entries → step, current step, glyph and tool count, `TodoWrite` / `TaskCreate` / `TaskUpdate` entries → todo progress, changes of the session's background tasks or running subagents → their counts, `Stop` → done (a `Stop` that keeps the session `running` because agent work is still in flight leaves it working, with the same start time), `SessionEnd` → closed. State and pending changes MUST be sent immediately; step, current step, progress, tool and task count changes at most every 15 seconds. On `Stop` it MUST update the activity to done (Android: a notification that is not persistent), keep the registration and end the activity 15 minutes later unless a new `UserPromptSubmit` comes first, which MUST turn the same activity back to working. On `SessionEnd` it MUST end it right away. On iOS the update uses the activity push token; on Android a notification with a per-session tag on the low-importance "Live status" channel. The Deny / Allow buttons of the activity SHALL reach the app as interactions whose target names the decision and the request id; the app SHALL answer with `permission.respond` over a short-lived connection, as it does for notification actions.

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

#### Scenario: Turn ends while agents work in the background
- **WHEN** a registered session fires `Stop` with a `subagent` item still running in `background_tasks`
- **THEN** the live status keeps showing working, and shows done on the later `Stop` with no agent work in flight
