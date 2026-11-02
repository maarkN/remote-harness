## Context

The live status is rendered three ways from one `LiveStatusProps` object: the iOS widget extension (`SessionActivity.tsx`, a `'widget'` function that can only use `@expo/ui/swift-ui` and images from the extension's asset catalog), the Android notification the app draws (`liveNotificationText` in the protocol package, so the system-drawn FCM fallback reads the same) and the app's own updates (`localLiveProps`). The daemon builds the props in `liveProps` from a `LiveStatus` and a `LiveSessionInfo`; the session's agent is known there through its profile (`Profile.agent`, absent = Claude Code).

## Goals / Non-Goals

Goals: the agent on every surface of the card; the done state in words; older daemons and apps keep working.

Non-Goals: real brand marks for the placeholder agents (#226 stays open; the badges use the same placeholder shapes as the app); redesigning the closed state.

## Decisions

1. **`agent` in the props, parsed leniently.** `LiveStatusPropsSchema.agent` uses the same lenient agent id as `Session.agent` (an unknown id reads as absent), so a newer daemon never breaks an older app. The daemon's `LiveSessionInfo` gains `agent`, filled from the profile; the app's `localLiveProps` copies `session.agent`.

2. **Badge images in the widget asset catalog.** The widget runtime cannot draw SVG paths, so `scripts/icons.mts` renders one PNG per agent (`assets/live-activity/agent-<id>.png`, 144 px: the agent color square with the app's icon path in the badge ink, exactly `AgentBadge`) and `withLiveActivityIcon` copies them into the extension's `Assets.xcassets` as `Agent-<id>` image sets next to `LiveActivityIcon`. In the layout, `mark()` picks `Agent-<agent>` when the agent is one of the five known ids (a literal list inside the widget function: no imports there) and the generic mark otherwise. The Android notification cannot carry a per-notification icon through expo-notifications, so the agent's display name leads the title ("Claude Code · Fix login · Done").

3. **Done state in words.** `liveTurnDuration(ms)` in the protocol package formats "40 s", "12 min", "1 h 05 min" or "2 h"; the daemon catalogs gain `activities.finishedAfter(duration)` (replacing `activities.finished`) and the app catalogs `liveStatus.finishedAfter` (replacing `liveStatus.finished`), so `activity` carries "Finished after 12 min" in the done state from both senders. The widget's times row shows `activity` (bold, state color) in place of the frozen timer and the "total" label when the state is done and the phrase is non-empty, and skips the separate phrase line then; the right side keeps "finished … ago". An older daemon still sending "Finished" shows that word there. `hint` keeps "total" for older app layouts.

4. **Agent names in one place.** The protocol exports `AGENT_LABELS` (product names, not translated) for `liveNotificationText`; the app's `AGENT_NAMES` becomes an alias of it.

## Risks / Trade-offs

- The widget layout cannot be tested on this Mac (the simulator does not render); the props and texts are unit-tested and the layout change is small and guarded by `labels`.
- Placeholder badges for Codex, Gemini, Kimi and Qwen reach the lock screen; they are the same shapes the app already shows and are documented as placeholders in `agent-icons/README.md`.
