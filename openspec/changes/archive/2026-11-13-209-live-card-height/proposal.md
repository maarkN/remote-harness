## Why

On the lock screen the Live Activity card is taller than the space iOS gives it, and the system clips it at the top and the bottom (#542, seen on the iOS 26.5 simulator on an iPhone 17 Pro Max and an iPad Pro 13", app in pt-BR, with props built by the daemon's own `liveProps`). While waiting, the header row is gone and Deny / Allow show only as a sliver that cannot be tapped, so the card fails the one state that asks for an action; while running, the header row is cut in half; in the expanded Dynamic Island the content stops at the current step line, so Deny / Allow never show there either.

Cause: the card of newer daemons (`card` in `features/live-status/SessionActivity.tsx`) stacks up to nine rows (header, session name, folder, times, phrase, current step, progress bar or glyph row, hint, buttons) with 14 pt of padding and 6 pt between rows, about 250 pt while waiting against the 160 pt iOS gives a Live Activity on the lock screen. The expanded Dynamic Island's bottom region stacks almost the same rows.

## What Changes

- Lock screen card, from top to bottom: the header row (badge, session name, state pill), one line with `<profile> · <machine>` and the folder (the two rows of the header block become one), the times row (timer at 26 pt instead of 30), while working the phrase with the glyph row beside it, the current step with the counts, and last the progress bar (working with a todo list), the buttons (waiting, at the small control size) or the hint (closed). Waiting drops the phrase and the glyph row: the state pill and the current step say what waits, and the buttons need the room. Padding 10 pt vertical, 4 pt between rows.
- Expanded Dynamic Island: the session name, then the state pill with the glyph row (while waiting, the pill with the current step), then while waiting Deny / Allow, otherwise the phrase and the current step with the counts. The folder and the progress bar leave the island (the `☑ 3/5` count stays).
- The older-daemon layout (no `labels` in the props) is unchanged: it is already short.
- Verified by rendering every state from the daemon's own props in the simulator, on the smallest supported iPhone and on iPad, in the three languages, with a long title and a todo list.

Out of scope: the big timer's word format and the island's edge insets (#543).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `live-status`: "Live status content" requires the card and the expanded island to fit in every state and sets the row order that makes them fit.

## Impact

- App: `features/live-status/SessionActivity.tsx` only (widget layout). No daemon, protocol or text change.
