## Why

Below a session card, the list draws one line per subagent ("⤷ Check the contrast… · running", "⤷ … · ✓ done"), up to three plus "+N subagents (M running)", and the card also has a separate "+2 subagents" pill (#562, iPhone screenshot). These lines sit between cards and make the list hard to scan.

Also found while reading `SubagentList.tsx`: the overflow line counts every running subagent, including the ones already shown above it, so with five running it can read "+2 subagents (5 running)".

## What Changes

- No more subagent lines between cards and no "+N subagents" pill: the card's state line shows the subagents as **state icons** (lucide, theme colors): a progress circle for running (accent), a check for done (success), an × for failed (danger), a square for stopped (warning). At most three, running first then the most recently updated, followed by "+N" for the rest, and "(M running)" counting only the hidden ones.
- The icons are one button, announced as "3 subagents: 1 running, 1 done, 1 failed", that opens the Subagents sheet (the same sheet as the session screen) over the list; a row of the sheet opens that subagent's conversation, as the nested lines did.
- Workflows: a run's agents are already the session's subagents (`workflowRunId`), so they show as icons like any other; the workflow card itself stays in the conversation, where its status is known. No new data from the daemon.
- Same icons in the compact and expanded densities (they sit on the state line, present in both).
- Pure logic (`cardSubagents`, `subagentStateCounts`) with Vitest tests, including the overflow count.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `subagents`: "Nesting in the app" (icons inside the card, the sheet from the list, the overflow count, workflows) and "Subagent outcome and badges" (where the badges and the icons appear).
- `app-session-list`: "Row anatomy" (the icons replace the "+N subagents" pill).

## Impact

- App: `features/subagents/sort.ts` (+ test), new `features/subagents/SubagentIcons.tsx`, `features/subagents/SubagentList.tsx` removed, `features/sessions/components/SessionRow.tsx`, `SessionListItem.tsx`, `SessionsScreen.tsx`, the three catalogs.
- No protocol or daemon change.
