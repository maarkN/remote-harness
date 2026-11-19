## ADDED Requirements

### Requirement: Terminal attach command
When the daemon opens a new terminal window attached to a session (the tray's "Open in terminal (tmux)", or `pane.focus` with no tmux client attached), the command that window runs SHALL name tmux by its absolute path, never a bare `tmux` looked up on the terminal's `PATH`. The daemon SHALL find that path the way `install` finds it for the launchers: `which tmux` on its own `PATH`, then the usual install locations (`/opt/homebrew/bin/tmux`, `/usr/local/bin/tmux`, `/usr/bin/tmux`, `/home/linuxbrew/.linuxbrew/bin/tmux`, `/snap/bin/tmux`) when `which` finds nothing; it MAY keep the result for its lifetime. Every terminal application SHALL run the command through `/bin/sh -c`, iTerm2 included, so the quoting and the `\;` between the tmux commands behave the same in all of them. The AppleScript that drives iTerm2 and Terminal.app SHALL address them by bundle id (`com.googlecode.iterm2`, `com.apple.Terminal`), never by name, so another item registered under the same name cannot take their place.

#### Scenario: iTerm2 started by LaunchServices
- **WHEN** the user picks "Open in terminal (tmux)" on a session, no tmux client is attached, iTerm2 is the terminal used and `tmux` lives in `/opt/homebrew/bin`, which is not on iTerm2's `PATH`
- **THEN** iTerm2 opens a window running `/bin/sh -c '/opt/homebrew/bin/tmux -L remote-harness -f … attach -t %20 \; select-window -t %20 \; select-pane -t %20'`, attached to that session's pane, instead of failing with "execvp failed"

#### Scenario: Same path as the launchers
- **WHEN** `which tmux` finds `/opt/homebrew/bin/tmux` on the daemon's `PATH`
- **THEN** the attach command and the launchers written by `install` both use `/opt/homebrew/bin/tmux`

#### Scenario: Service PATH without Homebrew
- **WHEN** `which tmux` finds nothing on the daemon's `PATH` and `/opt/homebrew/bin/tmux` exists
- **THEN** the attach command uses `/opt/homebrew/bin/tmux`

#### Scenario: Every terminal gets the absolute path
- **WHEN** a new window is opened in Ghostty, WezTerm, kitty, Alacritty, Terminal.app, a Linux terminal or Windows Terminal over WSL
- **THEN** the command it runs is `/bin/sh -c '<absolute tmux path> … attach …'`

#### Scenario: iTerm2 named by another registered item
- **WHEN** iTerm2 is the terminal used, it is not running, and LaunchServices also knows a terminfo entry registered as `iTerm2.app`
- **THEN** the script that opens the window still compiles and starts iTerm2, because it names `application id "com.googlecode.iterm2"`
