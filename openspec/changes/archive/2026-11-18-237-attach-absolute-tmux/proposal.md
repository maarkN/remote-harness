## Why

Clicking a session in the macOS tray with no tmux client attached opens an iTerm2 window that says "The program could not be run (execvp failed) … `tmux -L remote-harness -f ~/.remote-harness/tmux.conf attach -t %20 ; select-window -t %20 ; select-pane -t %20` … No such file or directory (errno 2)", and the session never shows (#612). The attach command names a bare `tmux`. The daemon finds it, because its launchd `PATH` was captured from the installing shell and holds `/opt/homebrew/bin`. The window is not the daemon's child, though: the terminal app runs the command with its own environment, and an app started by LaunchServices only has `/usr/bin:/bin:/usr/sbin:/sbin`, where Homebrew's `tmux` is not. iTerm2 runs the command directly (`execvp`), so it fails at once. Ghostty, kitty and Alacritty got `sh -c` through `open -na`, the same exposure one level down. The launchers do not have this problem: `install` writes the absolute path of `tmux` into them.

Verifying the fix on this Mac turned up a second iTerm2 failure: with iTerm2 not running, `tell application "iTerm2" to create window …` does not even compile ("A class name can't go after this identifier", -2740), old command or new. LaunchServices has terminfo entries registered as `…/terminfo/69/iTerm2.app` (from bundled toolchains), and the name resolves to one of them instead of `/Applications/iTerm.app`. Today's daemon only picks iTerm2 when it runs, which hides this, but choosing the terminal (#615) would expose it. By bundle id (`application id "com.googlecode.iterm2"`) the script compiles whether iTerm2 runs or not.

## What Changes

- The command a new terminal window runs to attach to a session names `tmux` by its absolute path, so it never depends on the terminal's `PATH`. The daemon looks the path up the way `install` does for the launchers: `which tmux` on its own `PATH`, then the usual install locations (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, Linuxbrew, snap) when `which` finds nothing. It does this once and keeps the result. `install` uses the same lookup, so the launchers and the attach command agree.
- Every terminal runs that command through `/bin/sh -c`, iTerm2 included (it ran the bare command before). Quoting and the `\;` between the tmux commands then behave the same everywhere. Terminal.app's `do script` and the Linux and WSL terminals get `/bin/sh` too, instead of a `sh` found on `PATH`.
- The AppleScript that drives iTerm2 and Terminal.app addresses them by bundle id instead of by name.
- Tests: the attach command starts with an absolute tmux path for every terminal (macOS apps, Linux `$TERMINAL` / `x-terminal-emulator`, WSL); iTerm2 gets `/bin/sh -c '<command>'`; the lookup prefers `which`, falls back to the first existing location, and runs once.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`: new requirement "Terminal attach command": how the command that attaches a new terminal window to a session names tmux and is run.

## Impact

- Daemon:
  - `infra/tmux.ts`: the tmux path lookup and `TmuxClient.absoluteBin()`.
  - `features/pane/terminal-focus.ts`: `attachCommand` takes the tmux path; every app runs `/bin/sh -c`.
  - `features/pane/show-in-terminal.ts`: passes the resolved path.
  - `features/setup/install.ts`: the shared lookup.
  - Tests in `test/terminal-focus.test.ts` and a test for the lookup.
- The tray's "Open in terminal (tmux)" and the app's `pane.focus` both go through this path. Existing computers get it with `remote-harness update`.
- No protocol, app or i18n change.
