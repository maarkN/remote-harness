## 1. Shared frame drawing

- [x] 1.1 Move `frameWrite`, `frameLines`, `carriedStyles` and `GLYPH_SUBSTITUTES` from `apps/mobile/src/features/terminal/frame-write.ts` to `packages/protocol/src/frame-write.ts` (exported from the index), with its tests; the app imports them from `@remote-harness/protocol`; verify the protocol tests and the app's typecheck and tests pass

## 2. Daemon pieces

- [x] 2.1 Tests first: `InputService.typeRaw` types the data with `send-keys -l` (and NUL as `send-keys -H 00`), inside the session lock, refuses a session without a pane and data over 100 KB; `TmuxClient.sendRaw` builds those calls. Verify they fail, implement, verify they pass
- [x] 2.2 Tests first: `PaneStreamer` accepts a plain viewer (`send` + `onClose`) and `refresh(sessionId)` captures right away for a subscribed session. Verify they fail, implement, verify they pass
- [x] 2.3 Tests first: `terminalPageHtml` embeds the xterm assets, takes input (posts `onData` to the `terminal` handler), carries both palettes with `prefers-color-scheme` and defines `writeFrame`; `readXtermAssets` finds the installed `@xterm/xterm` (added to the daemon's dependencies). Verify they fail, implement, verify they pass
- [x] 2.4 Tests first for `TerminalWindows` with fakes: `show` of a controllable session writes the page once and sends `terminal.open` with its title; `show` of a session without a pane sends nothing; `terminal.ready` subscribes a viewer and the first frame goes out as a full `terminal.frame`, a later diff as the changed rows; `terminal.input` types the data and refreshes the stream; `terminal.closed` unsubscribes; a renamed session gets `terminal.title`; an ended one `terminal.close` and is unsubscribed; a new helper (`reset`) drops every window. Verify they fail, implement, verify they pass

## 3. Tray wiring

- [x] 3.1 Tests first: the popover row's action is `window:<id>` when the helper reports `terminals` and the session is controllable, `focus:<id>` otherwise, and the context menu keeps `focus:<id>`; `TrayHost` passes `terminals` from `ready`, routes `terminal.*` messages and sends messages to the helper. Verify they fail, implement, verify they pass
- [x] 3.2 `registerUpdatesFeature`: the `window:` action opens the window, helper messages and session changes reach `TerminalWindows`; `main.ts` passes the streamer and the input service; verify the daemon typecheck and tests pass

## 4. macOS helper

- [x] 4.1 `Tray.swift`: `terminal.open` / `terminal.frame` / `terminal.title` / `terminal.close` messages; a window per session with a `WKWebView` loading the page, posting `ready` and `input`, reporting `terminal.closed`; `terminals: true` in `ready`; the hidden Edit menu (copy, paste, select all, close window); double-click in the Sessions window; verify `swiftc -O tray/macos/Tray.swift` builds without errors or warnings
- [x] 4.2 End to end on this Mac with a throwaway tmux server and a daemon from source: the helper built from this branch opens the window for a session running `cat -v` in a pane, the pane shows in it (screenshot), typed text, Return, an arrow key and Ctrl-C reach the pane (`capture-pane` shows them), closing the window leaves the pane running and stops the stream

## 5. Docs and verification

- [x] 5.1 `GLOSSARY.md`: **Terminal window**
- [x] 5.2 `pnpm check` green (typecheck, tests, Biome with warnings as errors); locally without the Go relay, which has no toolchain on this Mac and runs in CI
- [ ] 5.3 Pending, on the user's Mac after `remote-harness update`: clicking a tmux session in the popover opens its window with the live terminal, typing reaches the session, closing the window leaves it running, with no terminal app open
