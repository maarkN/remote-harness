## Why

Opening a session from the tray in an external terminal uses the first terminal app found running, in a fixed order (iTerm2 before Ghostty, `pickTerminalApp`). A terminal idling in the background wins over the one the user actually works in, and there is no way to choose (#615; the override proposed in #248 was never added). Since #614 there is also the Remote Harness terminal window, so the user has two kinds of places a session can open in.

Decided with the user while planning #614 and #615: the setting decides what a click on a session in the tray opens, and the terminal window is the default on macOS, existing installs included. That differs from the issue's "an existing install without the setting behaves as today". Without the setting, a click opens the terminal window (#614), and "Open in terminal (tmux)" picks the external app exactly as today.

## What Changes

- New `terminal` setting in `config.json`: `window`, `auto`, `ghostty`, `iterm2`, `wezterm`, `kitty`, `alacritty` or `terminal`.
  - Absent, it means `window` on macOS (where the tray opens terminal windows) and `auto` elsewhere.
  - `auto` is today's behavior: the first running app in the fixed order, else Terminal.app.
  - `window`, `iterm2` and `terminal` (Terminal.app) are macOS-only; elsewhere they count as `auto`.
- What a click on a tmux session in the macOS popover opens follows the setting: its terminal window for `window`, the chosen app (or `auto`) otherwise.
- "Open in terminal (tmux)" (the context menus, the waiting card, the Sessions window's Focus, the app's `pane.focus`) always opens an external terminal: the chosen app, or `auto` when the setting is `window`.
- The chosen app is used even when another terminal app is running. With a tmux client already attached, the chosen app is brought to the front if it runs; otherwise the first running app is, as today, since it owns that client.
- Fallback: a chosen app that is not installed falls back to `auto`, and the computer shows a notification naming the missing app and the one used instead.
  - macOS: the app bundle in `/Applications`, `~/Applications`, or Terminal.app in `/System/Applications/Utilities`.
  - Linux: the binary on `PATH`.
- Linux: `ghostty`, `kitty`, `alacritty` and `wezterm` override `$TERMINAL` / `x-terminal-emulator`, each run with its own way of taking a command. WSL keeps Windows Terminal.
- `remote-harness setup` asks for it, on the last step, with a `select`:
  - the terminal window (macOS), Automatic, and the installed apps, the one running the setup (`$TERM_PROGRAM` / `$TERM`) marked "(this terminal)";
  - preselected: the current setting, else the terminal window on macOS, else the running terminal when it is installed, else Automatic;
  - an unchanged answer writes nothing, and `--yes` keeps the current setting.
- Editable later:
  - in the tray: a picker "Open sessions in" in the General tab of the Preferences window (macOS), and a submenu of the Preferences submenu where the tray shows menus (Linux), listing the same choices;
  - with `remote-harness terminal [choice]`: no argument prints the setting and the choices; an argument saves it and asks the running daemon to reload. An unknown choice, or one not available on this system, is refused; a choice that is not installed is saved with a warning.
- Every click reads the setting again, so a change takes effect on the next click, without restarting the daemon.
- Labels in pt-BR, en-US and es-ES. Tests for the choice, the defaults, the fallback, the Linux apps, the setup options, the popover action and the Preferences rows.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`:
  - new requirement "Terminal choice";
  - "Tray popover": a click follows the setting.

## Impact

- Daemon:
  - `core/config.ts`: `terminal`, `TERMINAL_CHOICES`, the effective choice.
  - `features/pane/terminal-focus.ts`: the app bundles and Linux binaries, the chosen app, the Linux apps.
  - `features/pane/show-in-terminal.ts`: what is installed, the fallback.
  - `features/pane/index.ts` and `features/updates/index.ts`: read the setting, notify the fallback.
  - `features/updates/menu.ts` and `popover.ts`: the click action, the Preferences picker and submenu.
  - `features/setup/wizard.ts` and `profiles.ts`: the question and the config merge.
  - `cli.ts`: `remote-harness terminal`.
  - The i18n catalogs.
  - Tests.
- No protocol or app change.
