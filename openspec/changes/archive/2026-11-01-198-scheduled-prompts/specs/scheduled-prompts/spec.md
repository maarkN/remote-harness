## Purpose

Lets the user have the computer send a prompt at a time or on a schedule — to an open session or a new one — with the phone away, and keeps the user in charge of runs the computer missed.

## ADDED Requirements

### Requirement: Schedule model
A schedule SHALL have a title (at most 60 characters), a prompt (at most 8 KB, like a first prompt), a target — an existing session, or a new session with a profile and a folder, optionally in an isolated copy (worktree) and with a name — a time — once at a date and time, or repeating at a time of day on a set of weekdays (none = every day) — and an enabled switch. The computer's local time is the reference for every time. The daemon SHALL keep schedules in its data folder, written atomically, so they survive restarts, and SHALL report for each one when it runs next and what its last run did (`sent`, `queued`, `started`, `failed` with the reason, or `missed`).

#### Scenario: Weekday morning summary
- **WHEN** the user creates "Summarize yesterday's commits" for a new session in `~/code/app`, repeating at 09:00 on Monday to Friday
- **THEN** the daemon stores it and reports the next weekday at 09:00 (computer time) as its next run

#### Scenario: Survives a restart
- **WHEN** the daemon is stopped and started again
- **THEN** the schedules are there with their switches, next runs and last outcomes

### Requirement: Running a schedule
At its time, an enabled schedule SHALL run on the computer with no phone connected: for a session target the prompt goes through the message queue's rules (sent now when the session is free, queued while it is busy or has queued prompts; a session that is gone or read-only fails the run); for a new-session target the daemon starts the session with the prompt as its first prompt, as the New session screen does. A once schedule SHALL turn itself off after running; a repeating one SHALL take its next time. The outcome SHALL be recorded and sent to connected apps at once. "Run now" from the app SHALL run a schedule immediately, enabled or not, with the same outcomes.

#### Scenario: Session busy
- **WHEN** a schedule targets a session that is working at the schedule's time
- **THEN** the prompt is queued in that session, the outcome is `queued`, and it is delivered when the turn ends

#### Scenario: New session
- **WHEN** a schedule targets a new session in a folder with a profile
- **THEN** a session starts there with the prompt, the outcome is `started` and names the session

#### Scenario: Once
- **WHEN** a once schedule runs
- **THEN** it is disabled and has no next run

### Requirement: Missed runs
A run that comes due while the computer sleeps or the daemon is down SHALL NOT run late: once more than five minutes have passed since its time, the daemon SHALL record the run as `missed`, send the missed push, and move a repeating schedule on to its next time. The app SHALL show the missed run on the schedule with a **Run now** button, so the user decides whether to run it. On start the daemon SHALL apply the same rule to every enabled schedule whose time passed while it was down.

#### Scenario: Laptop asleep
- **WHEN** a schedule was due at 09:00 and the laptop wakes at 09:20
- **THEN** nothing runs, the schedule reads "Missed" with Run now, the phone gets "Scheduled prompt missed", and a repeating schedule's next run is the following occurrence

#### Scenario: Short pause
- **WHEN** the laptop wakes two minutes after a schedule's time
- **THEN** the schedule runs

### Requirement: Schedule pushes
When a schedule runs or fails, and when a run is missed, the daemon SHALL send a push titled "Scheduled prompt sent", "Scheduled prompt failed" or "Scheduled prompt missed", with the schedule's title as the body and, when known, the session's id in the data; never the prompt. The push follows the mute rules of the target's profile and session and is skipped while an app is in the foreground. Texts in pt-BR, en-US and es-ES.

#### Scenario: Ran
- **WHEN** "Daily summary" is sent to its session with the phone locked
- **THEN** the phone shows "Scheduled prompt sent · Daily summary", and tapping it opens that session

### Requirement: Managing schedules from the app
Settings → Sessions SHALL have **Scheduled prompts**, listing each schedule with its title, when it runs (in words: "Every weekday at 09:00", "Once on 2 Nov at 14:30"), its target (the session's title, or "New session · <folder>"), its next run, its last outcome and an enabled switch; missed and failed runs SHALL show **Run now**. A new or existing schedule SHALL be edited in a sheet with the title, the prompt (with a **Use a template…** picker), the target (an open controllable session, or a new session with a profile and a folder), the time (once with a date and a time, or repeat with weekday chips and a time; the fields say the time is the computer's) and Delete. A session's More options menu SHALL offer **Schedule a prompt…**, opening the editor with that session as the target. None of this SHALL appear on a daemon that does not announce `schedules`, nor in the offline demo. Texts in pt-BR, en-US and es-ES.

#### Scenario: From the session menu
- **WHEN** the user picks Schedule a prompt… in a session's menu and saves "Run the tests" once tomorrow at 08:00
- **THEN** the schedule appears in Scheduled prompts targeting that session, with tomorrow 08:00 as its next run

#### Scenario: Older daemon
- **WHEN** the daemon's `auth.ok` has no `schedules`
- **THEN** Settings shows no Scheduled prompts entry and the session menu no Schedule a prompt… item
