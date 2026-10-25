## Why

The live status card shows the turn timer and a step category, but not how long the session has been in its current state, how fresh the card is, or what the session is doing in plain words (#349). A glance at the lock screen should answer: what state, for how long, since when, and what is it doing right now.

## What Changes

- Card layout (iOS lock screen and Dynamic Island expanded): state pill in the header next to `<profile> · <machine>`; the big timer counts the time in the current state (working: the turn; waiting: the wait; done: frozen total) with a small label; on the right "notified … ago" (time since this update was sent) and, while waiting, the working time of the turn; done shows "finished … ago". A "what it's doing now" line (`↳ Running tests…`) above the current step and counts. Waiting adds an **Open** button next to Deny / Allow.
- Daemon: `activityPhrase` — a fixed, translated phrase picked from signals the daemon already has (tool name, file extension or directory, command program/subcommand, URL host); only the phrase leaves the daemon.
- Opt-in **Show the current task on the lock screen** (Settings → Notifications, off by default): when on, the daemon sends the in-progress todo's `activeForm` (from `TodoWrite`, `TaskCreate` / `TaskUpdate`), on one line and clipped to 48 characters. This is session content: the security rule in `CLAUDE.md`, the spec and the privacy policy (three languages) say so.
- Protocol: `LiveStatusProps` gains `activity`, `task`, `notifiedAt`, `link` and `labels` (all with defaults); `live.register` and the follow device gain `showTask?`.
- Android: the body leads with the task or phrase; while waiting the notification also has an **Open** action.
- Prototype `docs/design/identity/live.html` updated.

## Capabilities

### New Capabilities

### Modified Capabilities

- `live-status`: Live status content (new rows, phrase table, opt-in task) and Live status protocol (new props and `showTask`).

## Impact

- `packages/protocol/src/domain.ts`, `client.ts` (props, `showTask`), `liveNotificationText`.
- `apps/daemon/src/features/live-status/` (`activity.ts` new, `status.ts`, `service.ts`, `index.ts`), daemon i18n (three languages), tests.
- `apps/mobile/src/features/live-status/` (`SessionActivity.tsx`, `settings-store.ts`, `use-live-status.ts`, `use-live-follow.ts`, `logic.ts`, `android-notification.ts`, `android-renderer.ts`), `features/settings/NotificationsCard.tsx`, app i18n (three languages).
- `apps/web/content/*/privacy.md`, `CLAUDE.md`, `docs/design/identity/live.html`.
