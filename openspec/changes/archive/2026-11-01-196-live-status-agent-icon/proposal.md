## Why

The live status card (lock screen, Dynamic Island, Android notification) always shows the generic Remote Harness mark whatever agent runs the session, and once the turn ends it shows a frozen timer labelled "total" next to "finished … ago". Two design changes were asked in #471: show the session's agent (Claude Code, Codex, Gemini CLI, Kimi, Qwen) as the card's icon, so a glance says which harness finished or is waiting, and say in words how long the turn took in the done state ("Finished after 12 min").

## What Changes

- The live status props carry an optional `agent` (the session's agent id); the daemon sends it from the session's profile and the app sends it in the props it builds itself. Older daemons send none.
- The iOS card, the Dynamic Island views and the Android notification show the agent: on iOS the badge of the agent (its fixed color with its icon, as the session list draws it) replaces the generic mark; the Android notification title starts with the agent's name. Without an agent (older daemons, an unknown id) the generic mark and the plain title stay.
- In the done state the phrase line reads "Finished after X" with the turn's duration in words (seconds under a minute, else minutes, with hours past an hour) and takes the place of the frozen timer and its "total" label; "finished … ago" stays on the right. The closed state is unchanged. The phrase comes translated from the daemon's catalog or, for app-made updates, from the app's catalog.
- Agent badge images for the widget extension are generated from the app's icon paths (like the other brand assets) and copied into the widget's asset catalog at prebuild.
- Prototypes `live-activity-states.html` and `live-activity-lock-screen.html` updated.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `live-status`: "Live status content" (agent icon instead of the generic mark; the done state reads "Finished after X" in place of the frozen timer) and "Live status protocol" (optional `agent` in the props).

## Impact

- `packages/protocol/src/domain.ts`: `agent` in `LiveStatusPropsSchema`, `liveTurnDuration`, agent display names, `liveNotificationText` with the agent.
- `apps/daemon/src/features/live-status/status.ts` (`LiveSessionInfo.agent`, the done phrase), `live-status/index.ts` (agent from the profile), the three daemon catalogs (`activities.finishedAfter`).
- `apps/mobile`: `features/live-status/logic.ts` (`localLiveProps`), `SessionActivity.tsx` (agent mark, done row), `core/theme/agents.ts` (names from the protocol), `scripts/icons.mts` (agent badge PNGs in `assets/live-activity/`), `app.config.ts` (widget asset catalog), the three app catalogs (`liveStatus.finishedAfter`).
- Tests in the protocol, the daemon and the app; the widget assets change the native project, so the icon part ships in a store build (the props and texts work over the air).
