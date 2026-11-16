## Why

The "Waiting for you" strip above the session list shows only the oldest request, the number of sessions waiting in its header ("WAITING FOR YOU · 1") and a "+N more" text link (#561, iPhone screenshot). With several sessions waiting there is no sense of the queue, the next item is a small link that leaves the list, and nothing can be answered beyond the oldest one without opening each session.

## What Changes

- With two or more items, the strip is drawn as a **deck**: the front card is the item being shown (the oldest at first), with one card edge peeking below it for two items and two edges for three or more, and a counter badge "1/3 ›" in the header in place of the session count.
- Tapping the counter brings the next item to the front (wrapping to the first after the last); swiping the front card left brings the next one and right the previous one. The front card keeps the inline answers (Deny / Always / Allow) or Open, so any item of the queue can be answered from the list.
- When the front item is answered or resolved elsewhere, the item that takes its place comes forward with a short animation; with Reduce Motion there is no animation and no drag-follow.
- The counter is a button announced with its position ("2 of 3") and a hint; moving through the deck announces the new position and the session's title.
- With a single item the strip stays as today. The "+N more" link goes away.
- The strip model lists every item (oldest first) and small pure helpers place the front card (`deckFront`, `deckStep`, `deckEdges`), with Vitest tests.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-session-list`: "Waiting strip" (the deck for two or more items, the counter, swipe and tap to move through it, the animation and its accessibility).

## Impact

- App: `features/permissions/strip.ts` (+ test), `features/permissions/components/WaitingStrip.tsx`, the three catalogs.
- No protocol or daemon change.
