## Why

A prompt can only be sent by hand, at the moment: nothing lets the user say "every weekday at 9:00, in project X, summarize yesterday's commits" and have the computer do it even with the phone away (#432). The pieces exist — a first prompt at start (#430), templates (#431), the message queue for busy sessions — but no scheduler ties them to a clock.

## What Changes

- A scheduler in the daemon: schedules persisted atomically next to the queue, each with a title, a prompt, a target (an existing session, or a new session in a folder with a profile, optionally in a worktree and with a name) and a time (once at a date and time, or repeating at a time of day on chosen weekdays, in the computer's local time). The daemon runs them with the app closed, survives restarts, and reuses the message queue when the target session is busy.
- Missed runs (the computer was asleep or the daemon down past a grace period) are not run: the schedule records them as missed, the phone gets a content-free push and the schedule shows "Missed · Run now" in the app, so the user decides.
- A content-free push when a schedule ran (sent, queued or started a session) or failed, with the schedule's title as the body (never the prompt).
- Protocol: `schedules.list`, `schedule.create`, `schedule.update`, `schedule.remove`, `schedule.run`, the `schedules.result` reply and the `schedules.updated` broadcast; `auth.ok` announces `schedules`.
- App: Settings → Sessions → **Scheduled prompts** (list with next run, last outcome, enable switch, Run now, editor with a template picker), and "Schedule a prompt…" in a session's More options menu with the session as target. Hidden on daemons without schedules.

## Capabilities

### New Capabilities

- `scheduled-prompts`: schedules on the computer (model, timing, running, missed runs, persistence), their pushes and the app's management screens.

### Modified Capabilities

- `protocol`: "Message catalog" gains the schedule messages and the `schedules` flag on `auth.ok`.
- `push-notifications`: "Content-free payload" allows the schedule's title as the body of schedule pushes.

## Impact

- `packages/protocol/src/domain.ts` (schedule schemas), `client.ts`, `server.ts`.
- `apps/daemon/src/features/schedules/` (timing, store, service, wiring), `core/paths.ts`, `main.ts`, `features/push/service.ts`, the three daemon catalogs; tests.
- `apps/mobile/src/features/schedules/` (logic + tests, store, screen, editor, settings card), the session menu and screen, the main layout route, the three app catalogs; web docs (three languages).
