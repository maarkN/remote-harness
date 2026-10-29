## 1. Daemon

- [x] 1.1 `sessions/state.ts`: `agentWorkInFlight(backgroundTasks: unknown)` (agent types `subagent`/`workflow`, final statuses ignored, tolerant of unknown shapes) and `hookState` keeping `running` on a `Stop` with agent work; unit tests
- [x] 1.2 `SessionService.handleHook` passes `background_tasks` to `hookState`
- [x] 1.3 `SubagentTracker`: refresh `backgroundTasks` from `SubagentStop` when it carries the list; test
- [x] 1.4 Push: no "session finished" push on a `Stop` with agent work in flight; test
- [x] 1.5 Live status: a `Stop` with agent work in flight leaves the status working; test

## 2. Fixture

- [x] 2.1 `test/fixtures/hooks/workflow-run.json` (hook sequence of a workflow run, neutral values) and a test replaying it through the session service: `running` after the first `Stop`, `idle` after the wake-up turn's `Stop`

## 3. Verify

- [x] 3.1 Typecheck, tests and Biome green
