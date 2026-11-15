## Why

Two layout problems of the Live Activity in `features/live-status/SessionActivity.tsx`, seen with the app in pt-BR on the iOS 26.5 simulator (iPhone 17 Pro Max), separate from the card height (#542, change 209) (#543):

1. **Big timer truncated.** The lock screen card's timer shows words instead of `m:ss` and is cut by its 140 pt width: "6 minu…" while running, "<1 min…" while waiting. The same timer in the Dynamic Island shows digits ("0:57"). Both are `Text(date, style: .timer)` (what `@expo/ui`'s `dateStyle="timer"` maps to), a date style whose rendering iOS adapts to the room it gets; on the lock screen, with a large font and a bounded width, it picked a worded form, which the width then cut. The count-up timer ActivityKit documents for Live Activities is `Text(timerInterval:countsDown:)`, which renders only digits; `@expo/ui`'s `Text` exposes it (`timerInterval`, `countsDown`).
2. **Expanded Dynamic Island cuts its last row.** The bottom region puts text right against the island's edges: the last visible row is cut by the rounded corners and the bottom edge ("sh · pnpm", with the "Ba" of "Bash" hidden; "6 ferrament…"), in all three states.

## What Changes

- Every live timer of the Live Activity (lock screen card, compact and expanded Dynamic Island) becomes a count-up `timerInterval` text from the start of the current state, bounded a week later (a state never lasts that long; the timer stops there rather than run past it), with `lineLimit(1)` and a minimum scale factor, so it always reads `m:ss` or `h:mm:ss` and shrinks a little instead of being cut. The frozen duration once done or closed is unchanged.
- The expanded Dynamic Island's bottom region gets horizontal and bottom insets, so its rows stay clear of the rounded corners and the bottom edge.
- Verified by rendering running, waiting and done from the daemon's own props in the simulator, in en-US, pt-BR and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `live-status`: "Live status content" requires the big timer in digits and never truncated, and the expanded view's text inside the island.

## Impact

- App: `features/live-status/SessionActivity.tsx` only (widget layout). No daemon, protocol or text change. Depends on change 209 (#542), which reworked the same layout.
