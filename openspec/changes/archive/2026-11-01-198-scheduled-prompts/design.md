## Context

The daemon already has everything a run needs: `LifecycleService.start` launches a session with a first prompt, `QueueService.submit` delivers a prompt now or queues it while the session is busy, `PushService.notify` sends content-free pushes, and small persisted features (mute, queue) show the pattern: a JSON file written atomically, a service, a `register*Feature` that wires handlers and broadcasts. The app has a settings pattern for device-side lists (templates) and sheets for editors.

## Goals / Non-Goals

Goals: schedules that run on the computer without the app; explicit handling of missed runs (the user decides); the queue's rules when the session is busy; content-free pushes; management from the app with the existing form patterns.

Non-Goals: cron expressions (weekday sets and a time of day cover the asked case; a `cron` field can come later), time zones other than the computer's, attachments in scheduled prompts, catching up several missed runs.

## Decisions

1. **Model.** `Schedule { id, title (≤ 60), prompt (≤ 8 KB, the first-prompt cap), target, when, enabled, createdAt, updatedAt, lastRun, nextRunAt }`. `target` is `{ kind: 'session', sessionId }` or `{ kind: 'new', profileId, cwd, worktree?, name? }`; `when` is `{ kind: 'once', at }` (ISO) or `{ kind: 'repeat', time: 'HH:MM', days: [0-6] }` (empty days = every day; local time of the computer). `lastRun { at, outcome: sent | queued | started | failed | missed, error, sessionId }`. `nextRunAt` is computed by the daemon and sent to the app, which only displays it.

2. **Timing is pure and tick-based.** `features/schedules/timing.ts`: `nextRunAt(when, after)` and `isMissed(nextRunAt, now)` with a 5-minute grace. The service checks every 30 s (`TICK_MS`) instead of arming one long timer: a laptop that slept or a clock jump is noticed on the next tick, and a due run past the grace counts as missed. On start the same check runs once for every enabled schedule, so a daemon that was down reports what it missed and moves on to the next occurrence.

3. **Running reuses the existing services.** Session target → `queue.submit(sessionId, prompt, [], 'auto')`: `sent` when the session was free, `queued` when busy (the queue's own rules and cap apply; a missing or read-only session fails the run). New target → `lifecycle.start(profileId, cwd, { worktree, name, prompt })` → `started` with the new session id. A `once` schedule is disabled after its run; a repeating one gets its next time. Every outcome is persisted and broadcast as `schedules.updated` (the whole list, like `mute.updated`), and pushed through `PushService` as `scheduleRan` / `scheduleFailed` / `scheduleMissed` with the schedule's title as the body (the prompt never leaves the computer); the push follows the usual mute and foreground rules.

4. **Capability flag.** `auth.ok.schedules: true`; the app binds the store only then and hides the entry points otherwise.

5. **App.** `features/schedules/logic.ts` holds the pure parts (time and date parsing, the human description of `when` and of the target, the editor's validation into a `ScheduleInput`); `store.ts` mirrors the daemon's list; `SchedulesScreen` (route `/schedules`, from a Settings → Sessions card) lists them with a Run now button for missed and failed runs; `ScheduleEditorSheet` edits one (title, prompt with "Use a template…", target: an open session or a new session with profile and folder, when: once / repeat with weekday chips and a time field; text fields for time and date, validated, so no native picker is needed). The session menu's "Schedule a prompt…" opens the editor with the session preselected.

## Risks / Trade-offs

- The computer's local time is the reference: the app says so under the time field. Cross-timezone use (phone abroad) shows the computer's times.
- A 30 s tick costs nothing measurable and keeps the logic testable with a fake clock.
- Only one missed occurrence is reported per gap (the next one is computed from now); catching up is a conscious non-goal.
