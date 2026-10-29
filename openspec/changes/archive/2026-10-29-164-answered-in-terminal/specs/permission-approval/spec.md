## ADDED Requirements

### Requirement: Answered in the terminal while the hook is open
While a request's hook is still open, the daemon SHALL watch its session like a handed-over request. When the session moves on, the request SHALL be settled: the hook is answered with no decision (an empty answer: the agent already took the terminal's answer), the clients receive `permission.resolved` with `cancelled`, and its reminder and live status end. A question or plan approval SHALL settle on any of: a `tool_result` or `user` transcript entry of the session, or a `UserPromptSubmit`, `Stop`, `Interrupt` or `SessionEnd` hook of the session. A tool permission SHALL settle only on a `user` entry or one of those hooks, never on a `tool_result` alone (the hook carries no tool-use id and the result may belong to a tool that ran in parallel). A request settled by a `tool_result` SHALL put a session that has not ended back to `running`, like an answer from the phone; one settled by a hook leaves the state to that hook. Nothing SHALL be answered on the user's behalf.

#### Scenario: Question answered on the computer
- **WHEN** a question is open on the phone, its hook still waiting, and the user answers it in the terminal so the transcript gets its tool result
- **THEN** the hook ends with an empty answer, the clients receive `permission.resolved` with `cancelled` within seconds, and the session is `running`

#### Scenario: Plan approved on the computer
- **WHEN** a plan approval is open on the phone and the user approves it in the terminal
- **THEN** the request is resolved as `cancelled` as soon as its tool result is read, without waiting for `questionTimeoutSec`

#### Scenario: Parallel tool result during a tool permission
- **WHEN** a tool permission is open with its hook waiting and a tool result appears in the transcript
- **THEN** the request stays open on the phone

#### Scenario: Turn ended during a tool permission
- **WHEN** a tool permission is open with its hook waiting and the session's `Stop` hook arrives
- **THEN** the hook ends with an empty answer and the clients receive `permission.resolved` with `cancelled`
