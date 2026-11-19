## ADDED Requirements

### Requirement: Terminal choice
The `terminal` setting in `config.json` SHALL choose where the tray opens a session: `window` (its terminal window, macOS only), `auto` (the first running terminal app in the fixed order iTerm2, Ghostty, WezTerm, kitty, Alacritty, else Terminal.app, as before this requirement), or one app: `ghostty`, `iterm2` (macOS), `wezterm`, `kitty`, `alacritty` or `terminal` (Terminal.app, macOS). Absent, it SHALL mean `window` on macOS and `auto` elsewhere; a macOS-only choice SHALL count as `auto` elsewhere. A click on a tmux session in the macOS popover SHALL open it where the setting says. "Open in terminal (tmux)" (context menus, the waiting card, the Sessions window's Focus, the app's `pane.focus`) SHALL open an external terminal: the chosen app, or `auto` when the setting is `window`. With no tmux client attached, the chosen app SHALL open the session even while other terminal apps run; with a client attached, the chosen app SHALL be brought to the front when it runs, else the first running app as before. A chosen app that is not installed (macOS: its bundle in `/Applications`, `~/Applications` or, for Terminal.app, `/System/Applications/Utilities`; Linux: its binary on `PATH`) SHALL fall back to `auto`, and the computer SHALL show a notification naming the missing app and the one used. On Linux, `ghostty`, `kitty`, `alacritty` and `wezterm` SHALL replace `$TERMINAL` / `x-terminal-emulator`. Every click SHALL read the setting again, so a change applies to the next click without restarting the daemon.

`remote-harness setup` SHALL ask for it on its last step with a single choice of the terminal window (macOS), Automatic and the installed apps, marking the terminal running the setup (`$TERM_PROGRAM` / `$TERM`) "(this terminal)" and preselecting the current setting, else the terminal window on macOS, else that running terminal when installed, else Automatic; an unchanged answer MUST NOT write the config, and `--yes` MUST keep the current setting. The tray SHALL offer the same choices as "Open sessions in": a picker in the General tab of the Preferences window, and a submenu of the Preferences submenu on a helper that shows menus. `remote-harness terminal` SHALL print the setting and the choices, and `remote-harness terminal <choice>` SHALL save it and ask the running daemon to reload; it MUST refuse an unknown choice or one not available on the system, and warn when the chosen app is not installed. Every label and message MUST be translated.

#### Scenario: Ghostty chosen while iTerm2 runs
- **WHEN** Ghostty was chosen in setup, iTerm2 and Ghostty are both running, no tmux client is attached, and the user clicks a tmux session in the popover
- **THEN** the session opens in a new Ghostty window, not in iTerm2

#### Scenario: Existing install
- **WHEN** an install made before this requirement has no `terminal` setting, on macOS
- **THEN** a click on a tmux session opens its terminal window, and "Open in terminal (tmux)" opens the first running terminal app as before

#### Scenario: Change from the CLI
- **WHEN** the daemon runs and the user runs `remote-harness terminal kitty`
- **THEN** the config says `kitty`, the daemon reloads it, and the next click opens the session in kitty without restarting the daemon

#### Scenario: Change in Preferences
- **WHEN** the user picks iTerm2 under "Open sessions in" in the Preferences window
- **THEN** the config says `iterm2` and the next click opens the session in iTerm2

#### Scenario: Chosen app not installed
- **WHEN** the setting is `alacritty`, Alacritty is not installed and the user picks Open in terminal (tmux)
- **THEN** the session opens in the first running terminal app (else Terminal.app), and a notification says Alacritty was not found and which app was used

#### Scenario: Linux
- **WHEN** the setting is `kitty` on Linux with `$TERMINAL` set to `xterm`
- **THEN** a new kitty window attaches to the session's pane

#### Scenario: Setup
- **WHEN** `remote-harness setup` runs in Ghostty on macOS with Ghostty and iTerm2 installed and no `terminal` setting
- **THEN** it offers the terminal window (preselected), Automatic, Ghostty (this terminal) and iTerm2; `--yes` writes no `terminal` setting

#### Scenario: Refused choice
- **WHEN** the user runs `remote-harness terminal iterm2` on Linux, or `remote-harness terminal foo`
- **THEN** the command fails naming the choices available on the system and the config is unchanged

## MODIFIED Requirements

### Requirement: Tray popover
A helper that reports popover support (macOS) SHALL show, when the menu bar icon is clicked, a popover with cards instead of the menu, following the system appearance (dark or light), with top to bottom:
- a header with the product mark, "Remote Harness", `machine name · paths · version · since HH:MM` (the paths as in the menu's status line, never an address) and a state pill (running, updating or update available);
- **Waiting for you**, only while a tool permission waits: a card with the agent's badge, the session title, the profile, `Tool · detail` and how long it has waited, and the answers Deny, Always (when the daemon suggested a rule) and Allow, or only Open in terminal (tmux) when "Show permission requests here" is off;
- **Sessions** with the total and running counts: at most 5 live sessions as rows (agent badge, title, `folder · profile · worktree`, a state pill), a click opening the session where the `terminal` setting says (its terminal window by default, see "Session terminal window" and "Terminal choice") when it is controllable and a context menu with Open in terminal (tmux), which still opens an external terminal, Rename… and Close session; "See all sessions…" when more are live and a row with the ended count, both opening the Sessions window; "No sessions" when there are none;
- **Devices** with whether push is on: at most 3 paired devices, online first and then the most recently seen, each with when it paired and whether it is online now (and by which path) or offline, a click opening the Devices tab of the Preferences window; "See all devices (N)…" when more are paired, opening the same tab with every device; a hint to pair one when there are none;
- the quick actions: New session…, Pair a phone… (the Pairing tab of the Preferences window once the daemon listens, else the pairing in the terminal), Open the docs, Preferences…, the update action (Check for updates with the channel, Update now with the version when an update is available, disabled while checking or updating) and Quit (with the hide-icon and stop-service choices under a service manager).

Every label, count and time in the popover MUST come translated from the daemon; the helper only lays it out. The popover SHALL refresh live like the menu, and clicking an action SHALL close it.

#### Scenario: Allow from the popover
- **WHEN** a `Bash` permission waits and the user clicks Allow on its card
- **THEN** the daemon answers the request as if the app had, the card disappears and the glyph loses its dot

#### Scenario: Permissions only in the app
- **WHEN** "Show permission requests here" is off and a permission waits
- **THEN** the card shows the request with only Open in terminal (tmux)

#### Scenario: More sessions than fit
- **WHEN** 8 sessions are live
- **THEN** the popover lists 5 and "See all sessions…" opens the Sessions window with all 8

#### Scenario: Light appearance
- **WHEN** macOS uses the light appearance
- **THEN** the popover uses light backgrounds and dark text, keeping the amber accent and the state colors

#### Scenario: More devices than fit in the popover
- **WHEN** six devices are paired, one of them online
- **THEN** the popover lists the online one and the two most recently seen, and "See all devices (6)…" opens the Devices tab of the Preferences window with all six

#### Scenario: Three devices or fewer
- **WHEN** three devices are paired
- **THEN** the popover lists the three and shows no "See all devices" link

#### Scenario: Click a tmux session
- **WHEN** the user clicks a session that runs in a tmux pane and `terminal` is unset or `window`
- **THEN** its terminal window opens, or comes to the front when already open, and the popover closes

#### Scenario: Click with a terminal app chosen
- **WHEN** `terminal` is `ghostty` and the user clicks a session that runs in a tmux pane
- **THEN** the session opens in Ghostty, attached to its pane

#### Scenario: Open in terminal from the context menu
- **WHEN** the user picks Open in terminal (tmux) in a session row's context menu
- **THEN** the session opens in an external terminal app attached to its pane, as before
