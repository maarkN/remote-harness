## Why

In the macOS tray popover, the first two sessions ignored clicks while the third and later ones opened (#613). Nothing in the rows said why: same look, no hover, no message. The cause is confirmed in the code. A row gets a click action only when its session is controllable (`action: session.controllable ? focus : null` in the popover builder). A session becomes controllable only when its hooks carry a tmux pane id, that is, when it runs in a pane of the Remote Harness tmux server. The two top rows were sessions started with plain `claude` in Ghostty, outside that server, so there is no pane to open. They sat on top only because they were the most recent. Their Open in terminal (tmux) and Close session items were disabled as well, with no explanation.

Decided with the user: a click on such a session does nothing, but the row says why. Bringing the terminal app that runs it to the front (it cannot pick the right tab) and resuming it in tmux once it stops running elsewhere were set aside.

## What Changes

- A live session outside tmux (not controllable, not ended) is drawn differently in the macOS popover:
  - its title in the secondary color;
  - an "outside tmux" tag next to its state pill;
  - a tooltip explaining that it was started outside Remote Harness's tmux, so there is no terminal to open from the tray, and that sessions started with a profile's command can be opened.
  - A click still does nothing. Open in terminal (tmux) and Close session stay disabled in its context menu; Rename… stays available.
- The Sessions window gives such a row the same tag and tooltip, with Focus and Close disabled (as today).
- The plain menu (Linux, Windows, and macOS without the popover) labels the session `title · state · outside tmux`. Its submenu starts with the explanation as a disabled line.
- tmux sessions keep opening as before. Ended sessions are not tagged.
- Labels in pt-BR, en-US and es-ES.
- Tests for the popover and menu builders with a session outside tmux, a tmux session and an ended one.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`: new requirement "Sessions outside tmux in the tray".

## Impact

- Daemon:
  - `features/updates/popover.ts`: `outsideTmux` on a row.
  - `features/updates/menu.ts`: the menu label, the explanation line and the Sessions window's strings.
  - `tray/macos/Tray.swift`: decodes them and draws the tag, the muted title and the tooltips.
  - The i18n catalogs: `outsideTmux`, `outsideTmuxHint`.
  - Tests.
- The macOS helper is compiled on the computer when the daemon starts, so the new rows arrive with `remote-harness update`.
- No protocol or app change.
