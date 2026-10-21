## 1. Protocol

- [x] 1.1 `LiveStatusPropsSchema`: add `current` (string, default `''`) and `progress` (`{ done, total }` nonnegative ints, nullable, default `null`); update the doc comment on what the props may carry.
- [x] 1.2 `liveNotificationText`: body = current step (or the step category), `☑ done/total`, tasks, tools, glyphs.

## 2. Daemon

- [x] 2.1 `status.ts`: `stepTarget(name, input)` sanitizer (fixed table, ≤ 40 chars) and `stepForEntry` carrying `target`; `LiveStatus.current` set on each step (cleared on stop/end).
- [x] 2.2 `status.ts`: todo tracking (`TodoWrite` snapshot, `TaskCreate` / `TaskUpdate` counts, dedup by task id), `progress` carried over a new prompt only while unfinished; `todo` events from `stepForEntry`'s sibling `todoForEntry`.
- [x] 2.3 `status.ts`: `tasks` as `{ subagents, background }` (`taskCounts(session)` replaces `parallelTasks`), `tasks` event with both counts, `planSend` compares counts, current and progress.
- [x] 2.4 `liveProps`: `current`, `progress`, `tasks` from `live.subagents` / `live.background`; i18n in en-US, pt-BR, es-ES (replacing `live.tasks`).
- [x] 2.5 `index.ts` / `service.ts`: wire the new events and counts.
- [x] 2.6 Tests (`apps/daemon/test/live-status.test.ts`): sanitizer table (no command args, no directories, no patterns), todo progress (snapshot, Task tools, carry-over), split counts, Android body, iOS payload of a worst-case update under 4096 bytes.

## 3. App

- [x] 3.1 `SessionActivity.tsx`: drop the indeterminate `ProgressView`; determinate bar while working with `progress`; current step line with progress / tasks / tools in the banner and the expanded Dynamic Island.
- [x] 3.2 `logic.ts`: `localLiveProps` with the split counts (`taskCounts`), `current: ''`, `progress: null`; app i18n `liveStatus.subagents` / `liveStatus.background` in the three locales (replacing `liveStatus.tasks`); tests updated.
- [x] 3.3 Android notification test: body with current step and progress.

## 4. Docs and verification

- [x] 4.1 `CLAUDE.md` security line: the live status may also carry the current step's tool and sanitized target.
- [x] 4.2 `pnpm check` green; `npx expo export --platform ios` bundles.
