## Context

The session screen's header has a title button (opens `SessionDetailsSheet`) and an `ActionMenu` (⋮) fed by `sessionMenu()`, whose items depend on the session (controllable, subagents, provider) and the computer (shell commands, schedules, live follow, hands-free support). The tablet layout also has an inspector with the same details rows (`SessionDetailsList`).

## Decisions

### One sheet, two ways in

```
┌──────────────────────────────────────┐
│ [cl] Fix login bug              [×]  │  summary: badge, title (selectable), close
│ work · ~/code/app · ● running        │  profile, folder, state
├──────────────────────────────────────┤
│  [>_]     [▶]      [{}]     [⏰]     │  grid, 4 per row (the sheet is at most 560 pt)
│ Terminal Command Templates Schedule  │
│  [⟲]      [±]      [⑂]      [⌨]     │  toggles highlighted when on
│ History  Changes Subagents  Key bar  │
│  [⇣]      [📡]                        │
│ Follow  Live status                  │
│ Read-only session: …                 │  disabled reason, when there is one
├──────────────────────────────────────┤
│ DETAILS                              │  SessionDetailsList (as the inspector)
│ Folder   ~/code/app            Copy  │
│ …                                    │
├──────────────────────────────────────┤
│ [⏻ Close session]                    │  danger, apart; disabled when read-only
└──────────────────────────────────────┘
```

The title, the folder under the header, the status line's details and the ⋮ button all open this sheet; ⋮ stays until a later change removes it. A cell closes the sheet and runs the action, the same handlers the menu had.

### Grid content

The cells are `sessionMenu()`'s items minus Close session, in the same order, each with a short label (`sessionMenu.short.*`) under a lucide icon. The accessible label stays the full action label ("Hide keyboard shortcuts", "Stop following output"), so a toggle is announced by what it does; its cell is highlighted (`accentSoft` / `accent` border) while the toggle is on. Subagents shows an accent dot on its icon while any subagent runs, as the ⋮ button does. Disabled cells are dimmed and the reason (read-only) is written under the grid.

### `ui/Sheet`

A modal bottom sheet: dimmed backdrop as a sibling behind the panel (a `Pressable` around the panel would take the drag from its scroll view), Android back closes, `useKeyCommand` Esc closes, safe-area bottom padding, rounded top, an optional header (title and a close button), scrolling content, and at most 560 pt wide and centered on regular width (tablets). Other sheets can move to it later; this change only uses it for the session sheet.

### Keyboard

The app now draws the menu on iOS too, so the Android-only arrow navigation applies to both: ↑ / ↓ move a highlight between enabled cells (`nextEnabled`), Enter runs the highlighted one, Esc closes. ⌘⇧O opens the sheet.

## Risks / Trade-offs

- Opening another sheet from a cell (templates, model, schedule, run command) closes this one in the same render, as the list's action sheet already does with the close confirmation.
- The iOS system action sheet's VoiceOver handling is replaced by our own; cells are buttons with labels and states, the header is a heading.
