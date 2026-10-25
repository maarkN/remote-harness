## Why

Any single `session.updated` re-rendered every visible row of the session list, and the list keeps rendering while it is hidden under a conversation on phones and while it is the sidebar on tablets. Screens that only show a session's title and state also re-rendered on every status-line and activity tick (#357, part of #354).

## What Changes

- The list's rows become a memoized `SessionListItem` with plain props and stable callbacks; `renderItem` and `extraData` are stable, so an update of one session re-renders only its row. Swipe actions are built inside the row.
- Field selectors instead of whole-store or whole-map subscriptions: mute and pin lists in the list; the waiting strip selects only the sessions it can show; the new-session form only the started session's id and the suggested names; the muted-sessions sheet only the titles it lists.
- The session route and the tablet inspector use a session that ignores status-line and activity ticks; the composer reads only the session's state and profile; the details list (sheet and inspector) reads its session by id, so its activity time stays current.
- The search field filters once typing pauses for 150 ms.
- Nested subagents under a row are memoized and sorted once per change.
- Render-time ref writes in the list move to a layout effect, so the React Compiler can compile it.

## Capabilities

### New Capabilities

### Modified Capabilities

No spec-level behavior changes (`skip_specs: true`): the same list, rows and sheets, rendered less often.

## Impact

- `apps/mobile/src/features/sessions/` (`SessionsScreen`, new `components/SessionListItem.tsx`, `stable-session.ts` with tests, `use-stable-session.ts`, `components/SessionDetailsList.tsx`, `SessionDetailsSheet.tsx`), `features/permissions/strip.ts` (+ tests) and `WaitingStrip`, `features/lifecycle/NewSessionScreen.tsx`, `features/settings/NotificationsCard.tsx`, `features/autocomplete/SmartComposer.tsx`, `features/inspector/InspectorPane.tsx`, `features/subagents/SubagentList.tsx`, `app/(main)/session/[id]/index.tsx`, `core/utils/use-stable-callback.ts`.
