## Why

On iPad the inspector mounts the terminal next to the conversation, and the stack keeps the terminal screen mounted under other screens, so pane frames kept streaming while nobody looked. Each frame was Zod-parsed, stringified and injected into the WebView, where xterm reset the terminal and redrew the whole screen. This is the strongest suspect for the iPad 9th gen freeze (#267) (#359, part of #354).

## What Changes

- The terminal subscribes to the pane only while it can be seen (its screen or the session screen with the inspector focused, app in the foreground) and unsubscribes otherwise.
- The app draws at most one frame per display frame (the latest wins).
- The app computes what to write: the whole screen after a resize, otherwise only the changed rows, each cleared and rewritten in place with the colors it starts with (`capture-pane -e` carries attributes across lines). Unchanged frames write nothing. The page no longer resets the terminal or refits the font on every frame.
- No protocol change: line diffs on the wire ship with the connection relay epic (#362).

## Capabilities

### New Capabilities

### Modified Capabilities
- `raw-terminal`: the app's subscription follows visibility; frames are coalesced and drawn incrementally.

## Impact

- `apps/mobile/src/features/terminal/` (`frame-write.ts` with tests, `TerminalView.tsx`, `TerminalScreen.tsx`), `apps/mobile/scripts/build-xterm-html.mts` and the regenerated `xterm-html.generated.ts`.
