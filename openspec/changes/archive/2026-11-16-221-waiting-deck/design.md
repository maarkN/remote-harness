## Context

The strip sits above the session list (`SessionsScreen`, between the header and the FlashList), outside the list's scroll view, so a horizontal gesture on it does not compete with the vertical scroll. It renders one `StripItem` from `pendingForStrip` (oldest first) with the same answer flow as the session screen (`useRespond`, `AlwaysAllowSheet`).

## Decisions

### Layout

```
1 item (unchanged)                     2 items                              3+ items
┌──────────────────────────────┐      ┌──────────────────────────────┐     ┌──────────────────────────────┐
│ ⚠ WAITING FOR YOU · 1     2m │      │ ⚠ WAITING FOR YOU  [1/2 ›] 2m│     │ ⚠ WAITING FOR YOU  [1/3 ›] 2m│
│ [CC] Fix login bug    (work) │      │ [CC] Fix login bug    (work) │     │ [CC] Fix login bug    (work) │
│ Bash · npm test              │      │ Bash · npm test              │     │ Bash · npm test              │
│ [Deny] [Always] [Allow]      │      │ [Deny] [Always] [Allow]      │     │ [Deny] [Always] [Allow]      │
└──────────────────────────────┘      └──────────────────────────────┘     └──────────────────────────────┘
                                        └──────────────────────────┘         └──────────────────────────┘
                                                                               └──────────────────────┘
```

- Edges are 5 pt tall strips under the card, each inset 10 pt more on both sides than the one above, with the card's warning border (the second at a lower opacity). They are decorative and hidden from screen readers.
- The counter is a pill (`warningSoft` / `warning`, the strip's own tone) with "n/N ›"; it replaces "· N" in the header only in deck mode. The elapsed time is the front item's.
- Colors come from the theme tokens only (`surface`, `warning`, `warningSoft`), so the five themes follow; the strip keeps its current width, so on iPad it fills the list column as today.

### Front card position

The front card is tracked by the item's key (`request:<id>` or `waiting:<sessionId>`) plus the index it had. When the key is still in the list its index is used; otherwise (it was answered or resolved) the same index, clamped to the list, is shown: the item that took its place comes forward, or the previous one when the last item went away. Never navigating keeps the key unset, so the front is always the oldest. All of this is pure (`deckFront`, `deckStep`, `deckEdges`, `stripItemKey`) and tested.

### Gestures and motion

- A horizontal pan on the front card (active past 16 pt sideways, failing past 12 pt vertically, so taps on its buttons still work) follows the finger; released past 64 pt or with a fast flick, the card slides out and the next (left) or previous (right) item comes in. Otherwise it springs back.
- A new front card enters with a short fade and a lift from the edge below (opacity, 10 pt, 96 % scale, 200 ms).
- With Reduce Motion (`useReducedMotion`) the card does not follow the finger and nothing animates: the swipe and the counter just change the front card.

## Risks / Trade-offs

- A pan on the strip could be started by a slightly diagonal scroll attempt; the vertical fail offset keeps the list scrollable from the strip's area.
- Answering a non-oldest item from the deck is new: it uses the same `useRespond` path, so nothing changes on the daemon side.
