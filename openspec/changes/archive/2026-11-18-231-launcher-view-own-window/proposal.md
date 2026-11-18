## Why

Exiting a session started from a launcher can end the user's other sessions (#616). The launcher attaches the terminal through a view session grouped with the launchers' session, and a grouped session shares every window of the group. When the agent exits (`/exit`, or Ctrl+C twice) its window closes and tmux shows the next window of the group in that terminal, which is another running session. The user presses Ctrl+C again to "close this one" and ends that session too. On 2026-11-18 (macOS, Ghostty, tmux 3.7a), seven sessions ended one after another this way until the terminal tab was closed.

This was reproduced on a throwaway tmux server, with a client attached through a pty to a view grouped with a session that had three windows: once the view's window was killed, the same client showed another window of the group. `detach-on-destroy` does not help, because the view session itself is never destroyed while the group still has windows.

## What Changes

- The launcher's view session is no longer grouped. It is a session of its own that holds only the new window, linked from the launchers' session (`link-window`). It is created with a short placeholder window, the agent's window is linked into it and selected, and the placeholder is killed (`kill-window -a`), all in the same tmux command that attaches or switches the client.
- When the agent's window closes, the view is left with no windows and tmux destroys it. The view sets `detach-on-destroy` explicitly, so the user's own tmux settings cannot change what happens next:
  - In a plain terminal, and when nested in a pane of the user's own tmux, the setting is `on`: the client detaches and the terminal or pane is back at its shell prompt.
  - For a client of the Remote Harness server that was switched to the view, the setting is `off`: the client returns to the session it was on before.
- `destroy-unattached on` stays. When the terminal goes away (tab closed, `Ctrl-b d`), the view is destroyed and the window keeps running in the launchers' session, where the app, the tray and `remote-harness tmux` find it as before.
- The view no longer reaches other windows with tmux's window keys (`Ctrl-b n` / `p`): it shows only its own session. `remote-harness tmux` still shows them all.
- Tests:
  - The generated command, with the fake tmux, for the three paths (plain terminal, nested, switch-client).
  - An end-to-end run on a real tmux server: the view lists only its window, closing that window destroys the view while the other windows keep running, and detaching keeps the window. Skipped when tmux is not installed.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `launchers`: "Open session in tmux" now attaches through a view that holds only the new window and returns the terminal when that window closes, instead of a grouped view.

## Impact

- Daemon: `features/hooks/launcher.ts` (`renderLauncher`'s view commands) and its tests in `test/hooks.test.ts`.
- Existing computers get the new launchers on the next `remote-harness update`, which rewrites them through `install`. Views already open keep the old grouped behavior until their terminal closes.
- No protocol, app or i18n change.
