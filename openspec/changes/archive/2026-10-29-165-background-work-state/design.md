## Context

Claude Code's hook input schema (CLI 2.1.312) documents `background_tasks` on `Stop` and `SubagentStop`: "In-flight background work (running/pending + backgrounded) registered in this session. Lets hooks distinguish 'session is done' from 'session is paused waiting for background work to wake it'. Empty array when nothing is in flight." Each item is `{ id, type, status, description, command?, agent_type?, server?, tool?, name? }`, where `type` is a friendly label such as `shell`, `subagent`, `monitor` or `workflow` (`name` is the workflow name). A workflow run or a background agent ends with a task notification that wakes the session for a new turn, which ends with another `Stop`. That wake-up turn fires no `UserPromptSubmit`.

The daemon already stores the list length as `backgroundTasks` (change 18) but maps every `Stop` to `idle`.

## Goals / Non-Goals

**Goals:** a session whose agents still work after `Stop` stays `running` until a `Stop` without agent work; pushes and the live status follow.

**Non-Goals:** showing the workflow run in the conversation (#440); a new session state or protocol field; session crons (`session_crons`: a scheduled wake-up is not work in progress).

## Decisions

- **Only agent work holds the session.** `subagent` and `workflow` items keep it `running`; `shell` and `monitor` items (and unknown types) do not. A background dev server or a `Monitor` watch can live for hours, and the session takes prompts meanwhile; holding it `running` would also stop queued prompts from being delivered. Alternative considered: any item holds the session — rejected for that reason.
- **Status filter.** The list is in-flight by definition, but an item whose `status` is final (`completed`, `failed`, `killed`, `cancelled`, `stopped`) is ignored, in case a finished task is still listed.
- **Pure rule in `sessions/state.ts`.** `agentWorkInFlight(payload.background_tasks)` (tolerant of unknown shapes) and `hookState(event, notificationType, backgroundTasks)`; push and live status use the same function, so the three always agree.
- **No new state.** The session is `running`; the existing "background" badge carries the detail. The queue keeps waiting for `idle`, so a queued prompt goes after the agents finish, which is what "send next" means.
- **Fixture.** `test/fixtures/hooks/workflow-run.json`: the hook sequence of a workflow run (prompt, `SubagentStop`s, `Stop` with a running workflow, wake-up turn's `Stop` with nothing in flight), built from the schema with neutral values.

## Risks / Trade-offs

- [The wake-up turn never ends with `Stop` (crash, `StopFailure`)] → the session stays `running` until the next hook (`UserPromptSubmit`, `SessionEnd`, dead pane), as it does today for any turn that never ends.
- [Claude Code renames the type labels] → unknown types count as non-agent work, so the worst case is today's behavior (`idle`).
