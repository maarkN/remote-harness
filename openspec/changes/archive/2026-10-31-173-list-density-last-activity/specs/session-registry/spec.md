## ADDED Requirements

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
