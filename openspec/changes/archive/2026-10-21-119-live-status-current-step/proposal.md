## Why

The Live Status (iOS Live Activity / Dynamic Island, Android notification) says a session is working but says little about **what** it is doing: a step category ("running a command"), a tool count and a combined "2 tasks running". And while working, the activity shows an indeterminate `ProgressView`, which widgets don't animate: it renders as a circle that never moves and looks broken (issue #312).

## What Changes

- **Current step**: the props gain `current`, the tool and a short, sanitized target of the step running now (`Bash · pnpm test`, `Edit · app.ts`, `WebFetch · github.com`, `Agent · Explore`). The target is derived by the daemon from the tool input through a fixed table and never carries the input itself: file tools give the file's base name, Bash the program (plus its subcommand for a short list of programs such as `git`, `pnpm`, `npm`), WebFetch the host name, Agent/Task the subagent type; every other tool (search patterns, web queries, MCP tools) gives no target.
- **Task progress**: the props gain `progress` (`{ done, total }` or `null`) from the session's todo list: the latest `TodoWrite` snapshot, or the `TaskCreate` / `TaskUpdate` calls of newer Claude Code versions. An unfinished list carries over to the next turn; a finished one does not.
- **Subagents apart from background tasks**: the `tasks` text names running subagents and background tasks separately ("2 subagents · 1 background task") instead of "3 tasks running".
- **No frozen spinner**: the indeterminate `ProgressView` goes away. While working with a todo list, the banner shows a determinate bar (`ProgressView(value:)`) and `☑ 3/7`; without one, only the timer and the state line show progress.
- **Layout**: the lock screen and the expanded Dynamic Island show the current step in its own line, with the progress, subagent/background counts and tool count beside it; the Android notification body starts with the current step and the progress.
- **Security rule**: the live status push may now carry the current step's tool and sanitized target, besides the session title and folder. `CLAUDE.md` and the live-status spec say so.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `live-status`: "Live status content" (current step line, progress bar and count, subagents apart, no indeterminate bar, what the payload may carry), "Live status updates" (todo progress and current step from transcript entries) and "Live status protocol" (`current`, `progress`).

## Impact

- `packages/protocol/src/domain.ts`: `LiveStatusPropsSchema` gains `current` and `progress` (with defaults); `liveNotificationText` puts them first in the body.
- `apps/daemon/src/features/live-status/status.ts` (pure: target sanitizer, todo tracking, task counts), `index.ts`, `service.ts`; daemon i18n (`live.subagents`, `live.background` replace `live.tasks`) in the three locales.
- `apps/mobile/src/features/live-status/SessionActivity.tsx` (layout, no indeterminate bar), `logic.ts` (`localLiveProps` with the split counts); app i18n keys in the three locales.
- Tests: daemon `live-status`, app `live-status` logic and Android notification, payload size of a worst-case update under the APNs 4 KB limit.
- `CLAUDE.md` security line.
