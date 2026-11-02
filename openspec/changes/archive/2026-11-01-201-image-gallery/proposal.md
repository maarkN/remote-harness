## Why

The full-screen viewer shows one image; to see the next one the user closes it and taps another thumbnail (#478). Asked: open an image and move to the previous and next ones by swiping, with a thumbnail strip at the bottom to jump, like a photo gallery.

## What Changes

- The viewer takes the images of the same message (a prompt's or a tool result's `ImageStrip`, which already knows the index and the count) and moves between them: a horizontal swipe at 1× (a zoomed image keeps panning), a tap on a thumbnail, or the Previous / Next buttons (also for VoiceOver / TalkBack). The "2 of 5" counter follows.
- A thumbnail strip at the bottom with the current image highlighted, hidden with a single image; thumbnails reuse the transcript image cache and its two-at-a-time fetch queue.
- Pure helpers for the next / previous index and for what a swipe does, tested; labels in pt-BR, en-US and es-ES.
- Follow-up, not here: all the images of the conversation in one gallery.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: "Images in the conversation" (the viewer as a gallery of the message's images).

## Impact

- `apps/mobile/src/features/images/{ImageViewer.tsx,ImageStrip.tsx,gallery.ts,gallery.test.ts}`, the three app catalogs. No daemon or protocol change.
