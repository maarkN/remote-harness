## Why

Opening a session from the tray depends on an external terminal app and on attaching a tmux client to the Remote Harness tmux server (#614). It uses whichever terminal happens to be running, it failed when that app could not find `tmux` (#612), and it does nothing for sessions outside tmux (#613). The app already shows a live view of a session's pane (the Terminal tab). The computer the session runs on deserves the same view, one click away, with nothing else to set up.

## What Changes

- Clicking a tmux session in the macOS popover opens a Remote Harness **terminal window** for that session. The window mirrors its tmux pane with the same xterm.js view as the app's Terminal tab, and what is typed in it reaches the session. The click raises the window when it is already open; there is one window per session.
- The window lives in the tray helper: an `NSWindow` with a `WKWebView` (WebKit is a system framework, so the helper still builds with plain `swiftc`). Its page is built by the daemon from the `@xterm/xterm` package, now a daemon dependency, and written next to the helper.
- The daemon feeds the window the pane stream the app gets (`pane.frame` / `pane.diff`, drawn with the app's own row diffing) over the helper's stdin. What is typed comes back on the helper's stdout and is typed into the pane through the daemon's input feature. There is no new port, socket or authentication.
- Window title = session title, updated on rename. Theme = the system appearance (the app's dark and light terminal palettes), like the popover. Closing the window leaves the session running. The window closes when the session ends or loses its pane.
- "Open in terminal (tmux)" stays in the row's context menu and still opens an external terminal. The Sessions window opens the terminal window on a double-click of a tmux session.
- The app's pure `frameWrite` (how a frame is written to xterm.js: whole screen or changed rows, glyph substitutes) moves to `@remote-harness/protocol`, so the app and the window draw frames the same way.
- Out of scope: the Linux tray (WebKit2GTK), the Windows tray, and a window for sessions outside tmux.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`:
  - new requirement "Session terminal window";
  - "Tray popover": a click on a tmux session opens its terminal window;
  - "Sessions window": double-click opens it.

## Impact

- Daemon:
  - `features/updates/terminal-windows.ts`: open, stream, input, close; new.
  - `features/updates/terminal-page.ts`: the page and the two themes; new.
  - `features/updates/tray-host.ts`: routes the helper's terminal messages and sends messages to it.
  - `features/updates/popover.ts` and `menu.ts`: the row's `window:` action, the helper's `terminals` support.
  - `features/updates/index.ts`: the `window:` action and the wiring.
  - `features/pane/streamer.ts`: accepts any viewer and refreshes right after input.
  - `features/input/service.ts` and `infra/tmux.ts`: typing raw terminal input.
  - `infra/tray-helper.ts`: reads the xterm assets.
  - `main.ts`: passes the streamer and the input service to the tray.
  - `tray/macos/Tray.swift`: the windows, the Edit key equivalents (copy, paste, select all, close).
  - `package.json`: `@xterm/xterm`.
- Protocol: `frameWrite` and its tests move from the app.
- App: imports `frameWrite` from the protocol; JavaScript only, no behavior change.
- `GLOSSARY.md`: **Terminal window**.
- No protocol message change; no i18n change (the window shows the session title and the pane only).
