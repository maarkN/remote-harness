## Why

The session details sheet sometimes doesn't scroll: whether a drag scrolls depends on where the finger lands (issue #310). `SessionDetailsSheet.tsx` nests the `ScrollView` inside a `Pressable` (the sheet, there only so taps inside don't close the modal) inside another `Pressable` (the backdrop). Pressables claim the touch responder on touch start, so a drag that starts on a label, a value or a gap can be owned by the sheet's `Pressable` and never reach the `ScrollView`.

## What Changes

- The sheet becomes a plain `View`; the backdrop becomes its own `Pressable` filling the modal behind the sheet (a sibling, not a parent). Tapping the dimmed area still closes; a tap inside lands on the sheet, which isn't a responder, so it neither closes it nor steals the scroll gesture.
- `SessionDetailsList` keeps its rows as plain `View`s with selectable `Text` (a long press selects; a drag scrolls) and the Copy `Pressable` only on its button, so no row claims the drag.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `app-conversation`: the "Session details" requirement states that the sheet scrolls from any point of its content.

## Impact

- `apps/mobile/src/features/sessions/components/SessionDetailsSheet.tsx`.
- No i18n, daemon, or protocol impact.
