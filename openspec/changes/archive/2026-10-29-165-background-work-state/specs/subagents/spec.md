## MODIFIED Requirements

### Requirement: Background tasks
The session SHALL expose `backgroundTasks` with the background tasks reported in the last `Stop` or `SubagentStop` that carries `background_tasks` (a `SubagentStop` without the field leaves the count unchanged).

#### Scenario: Background command
- **WHEN** `Stop` reports a background task
- **THEN** the session appears in the list with a "background" badge and the task count

#### Scenario: Agent of a workflow stops
- **WHEN** a `SubagentStop` arrives with `background_tasks` listing one remaining workflow
- **THEN** the session's `backgroundTasks` becomes 1 and its state does not change
