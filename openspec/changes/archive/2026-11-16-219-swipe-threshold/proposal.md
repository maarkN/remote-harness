## Why

On the session list, swiping a row only part of the way already runs its main action: to the right it mutes the session, to the left it opens Close, or hides a read-only session at once with no way back (#559, iPhone screenshots). The user expects a short swipe to only reveal the buttons, and the action to run only after a deliberate long swipe.

Cause, read in `SwipeableRow.tsx` and in `ReanimatedSwipeable` (react-native-gesture-handler 2.32) and pinned by a Vitest test: the full-swipe action fires from a `useAnimatedReaction` once the row's translation (`drag`) reaches ±`FULL_SWIPE_PT` = 150 pt, but the revealed panel is 2 × 76 + 16 = 168 pt wide. Released past `leftThreshold`/`rightThreshold` (40 pt of translation, 80 pt of finger with `friction={2}`, less with a flick since the release adds the velocity), the library springs the row open to ±168, and on the way the translation crosses 150. Revealing the buttons is therefore enough to fire the first action on the right (Mute) and the last one on the left (Close, or Hide). The reaction cannot tell the finger from the spring, and with `overshootLeft/Right={false}` and `friction={2}` a real long swipe could barely go past the panel anyway.

## What Changes

- The full-swipe distance becomes half the row's width, and never less than the open panel plus 24 pt, so the row's resting open position can never reach it.
- The action only fires when the finger is lifted past that distance: the gesture's own release (`onSwipeableWillOpen` / `onSwipeableWillClose` while a drag is in progress) decides, never the opening or closing animation.
- The row follows the finger 1:1 (`friction={1}`) and may be dragged past the panel (`overshoot` on); the outermost action stretches to fill the space, so the long swipe reads as "this one".
- A haptic tick when the drag crosses the full-swipe distance (and a lighter one when it goes back), so the user knows before releasing; no extra vibration on release.
- Hiding a session (full swipe, the Hide button or the action sheet) shows "Session hidden" with **Undo** for 5 seconds at the bottom of the list, announced to screen readers. A new `ui/UndoBar` component.
- Pure threshold logic (`features/sessions/swipe.ts`) with Vitest tests, including the regression above.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-session-list`: "Swipe actions and action sheet" (the full-swipe distance, release-only firing, the haptic, the outermost action of each side) and "Pinned and hidden sessions" (Undo after hiding).

## Impact

- App: `features/sessions/components/SwipeableRow.tsx`, new `features/sessions/swipe.ts` (+ test), `features/sessions/SessionsScreen.tsx`, new `ui/UndoBar.tsx`, the three catalogs.
- No protocol or daemon change.
