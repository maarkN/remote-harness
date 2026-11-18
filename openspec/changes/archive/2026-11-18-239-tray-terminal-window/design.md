## Context

The macOS tray helper (`tray/macos/Tray.swift`) is compiled by the daemon with `swiftc` when it starts and talks JSON lines: the daemon sends `menu` messages on stdin, the helper sends `ready` and `click` on stdout. It already opens native windows (Preferences, Sessions) from data the daemon sends. The app's Terminal tab subscribes to a pane (`pane.subscribe`): the daemon's `PaneStreamer` polls `capture-pane` every 250 ms for subscribed sessions and pushes a full `pane.frame` to new viewers, then `pane.diff`. The app keeps the last frame, computes what to write with `frameWrite` (whole screen after a resize, otherwise the changed rows) and injects it into an xterm.js page (`window.writeFrame`).

## Decisions

### The window is a viewer of the pane stream, over the helper's pipes

```
popover row click ─► helper ─click window:<id>─► daemon TerminalWindows.show
                                                  │ writes terminal.html once
helper ◄──── terminal.open {sessionId,title,page} ┘
helper loads the page ─► terminal.ready ─► daemon: streamer.subscribe(session, pane, viewer)
PaneStreamer ─pane.frame / pane.diff─► viewer ─frameWrite─► terminal.frame {write} ─► helper ─► writeFrame()
xterm onData ─► helper ─terminal.input {data}─► daemon InputService.typeRaw ─► tmux send-keys -l
window closed ─► terminal.closed ─► viewer's onClose ─► streamer unsubscribes
session ended / no pane ─► terminal.close ─► helper closes the window
```

`PaneStreamer` takes any `PaneViewer` (`send` + `onClose`), the subset of `Connection` it uses, so a window is one more viewer of the same stream as the app's. No WebSocket, port or key: the helper is the daemon's child and its pipes are private to it.

### Frames are drawn exactly as in the app

`frameWrite` moves from the app to `@remote-harness/protocol` (next to `diffPaneFrames` / `applyPaneDiff`), so the window gets the same full-or-changed-rows writes and the same glyph substitutes. The daemon side of a window keeps the last frame (to apply diffs) and the frame on screen (to compute the write); a page that (re)loads reports `ready` and gets a full frame.

### The page

Built by the daemon (`terminalPageHtml`) from the `@xterm/xterm` files resolved at runtime (a daemon dependency, installed by `pnpm install --filter '@remote-harness/daemon...'`), written once per daemon process to the helper's build folder, loaded with `loadFileURL`. Unlike the app's page it takes input (`disableStdin: false`, `onData` posted to the helper), carries both palettes (the app's `dark` and `light` terminal colors and ANSI sets) and switches on `prefers-color-scheme`, which WebKit takes from the system appearance, like the popover. The font size fits the pane's columns and rows to the window, and follows window resizes.

### Typing

xterm.js turns keys into the bytes a terminal sends (`\r`, `\x7f`, `\x1b[A`, `\x03`…). The daemon types them with `tmux send-keys -l` (each character as a key, control characters included), inside the session's input lock like any other input, and asks the streamer for a frame right after so the echo does not wait for the next 250 ms tick. NUL (Ctrl-Space) cannot travel as an argument and is sent as `send-keys -H 00`. The 100 KB input limit applies (a large paste). What is typed is never logged.

### Click targets

The popover row's action becomes `window:<id>` when the helper reports `terminals: true` in `ready` and the session is controllable; the context menu keeps `focus:<id>` (Open in terminal (tmux)). The plain menu (Linux, Windows) is unchanged. In the Sessions window a double-click on a tmux session sends `window:<id>`; its buttons stay as they are.

### Edit key equivalents

An accessory app has no menu bar, and without an Edit menu WebKit gets no ⌘C / ⌘V / ⌘A. The helper sets a main menu (never shown) with Copy, Paste, Select All and Close Window so these keys work in the terminal window (and the Preferences text fields).

## Risks / Trade-offs

- A mirror, not a terminal: the window does not resize the pane, so the font scales to fit; there is no scrollback beyond the screen (as in the app).
- Echo latency is one `capture-pane` after the key (~50 ms) instead of a real pty; enough for answering prompts and menus, not meant for long editing sessions.
- `send-keys -l` relies on tmux mapping control characters to keys; checked against tmux 3.7a with a pane running `cat -v`.
- The page is ~500 KB written at the first window of each daemon run.
