## MODIFIED Requirements

### Requirement: Tray icon
When a supported helper is available (macOS menu bar; Linux AppIndicator), the service daemon SHALL show a tray icon whose glyph encodes only the state (on macOS a 22-point glyph, the tallest that fits the menu bar): the mark as a template image when idle, the ring filled while any session works, an amber dot (the only color) while a permission waits, and 40 % opacity when the daemon is gone. A helper that shows menus (Linux, and macOS only if the popover is unavailable) SHALL show, top to bottom: the status (`machine name · paths · version · since HH:MM`, where the paths say whether devices reach the computer by the direct path, the relay path, both or neither — never an address); **Waiting for you** with the oldest pending tool permission (`session title · Tool · detail`) and Allow, Always allow (when the daemon suggested a rule, saved like the app does), Deny and Open in terminal (tmux); **Sessions** by recency, each as `title · state` with its folder, profile and worktree, Open in terminal (tmux), Rename… and Close session (the graceful close), the ended ones collapsed in one submenu; **Devices** with whether push is on and at most 3 paired devices (online first, then the most recently seen), each as `name · online (path)` or `name · offline`, whose submenu shows when it paired and "Revoke…", a nested confirmation that revokes the device like `remote-harness devices revoke`; when more are paired, the section ends with "See all devices (N)…" opening the Devices tab of the Preferences window on a helper that can open windows, or with a "See all devices (N)" submenu holding every device (each with the same submenu) on a helper without window support; New session…, Pair a phone…, Open the docs and Preferences…; then "Check for updates", "Update now" (when an update is available), the automatic updates toggle, the channel choice, "Open logs", "Restart daemon" (under a service manager), "Run doctor" and "Quit tray". The menu SHALL refresh on session, permission and device changes (a device connecting, disconnecting, pairing or being revoked). A helper that reports it can open windows (macOS) SHALL list at most 5 live sessions before a trailing "See all sessions…" item; a helper without window support (Linux; Windows) keeps listing up to 8. Without a helper the daemon MUST keep working headless. `tray: false` in the config SHALL disable it. All labels MUST be translated. The popover has its own requirement, as do Pair a phone, Preferences, the Sessions window and rename.

#### Scenario: Update from the menu bar
- **WHEN** an update is available and the user chooses "Update now"
- **THEN** the update runs and the daemon restarts on the new version

#### Scenario: No graphical session
- **WHEN** the daemon runs on a Linux server without a display
- **THEN** no tray is started and the daemon works as before

#### Scenario: Allow from the menu bar
- **WHEN** a `Bash` permission waits and the user picks Allow under "Waiting for you"
- **THEN** the daemon answers the request as if the app had, the glyph loses its dot and the section disappears

#### Scenario: Focus a session
- **WHEN** the user picks "Open in terminal (tmux)" on a session and a terminal client is already attached to a different tmux session
- **THEN** the daemon switches that client to the picked session's window and pane and brings the terminal application owning that client to the front

#### Scenario: Open a session with no terminal attached
- **WHEN** the user picks "Open in terminal (tmux)" on a session and no terminal client is attached to any tmux session
- **THEN** the daemon opens a new terminal window that attaches to that session's window and pane

#### Scenario: No supported terminal found
- **WHEN** the user picks "Open in terminal (tmux)" and no terminal application the daemon knows how to drive is installed or running
- **THEN** the action fails instead of doing nothing silently, and the daemon logs the failure like it does for any other failed tray action

#### Scenario: Working glyph
- **WHEN** a session is running and nothing waits
- **THEN** the menu bar shows the mark with its ring filled, as a template image

#### Scenario: More than 5 sessions on macOS
- **WHEN** 8 sessions are live and the helper supports windows
- **THEN** the menu lists the 5 most relevant (waiting first, then most recent) and a trailing "See all sessions…" opens the Sessions window with all 8

#### Scenario: More than 5 sessions on Linux
- **WHEN** 8 sessions are live and the helper does not support windows
- **THEN** the menu keeps listing up to 8, as before, with no "See all sessions…" item

#### Scenario: Revoke a device from the menu
- **WHEN** the user picks Revoke… on a paired iPhone under Devices and confirms
- **THEN** the iPhone is unpaired, its open connections close, it no longer gets pushes, and it disappears from the Devices section

#### Scenario: Paths in the status line
- **WHEN** the daemon listens on the direct path and is connected to its home relay
- **THEN** the status line reads `<machine name> · direct + relay paths · <version> · since <HH:MM>`, with no IP address

#### Scenario: More devices than fit in the menu
- **WHEN** six devices are paired and the helper has no window support (Linux; Windows)
- **THEN** the Devices section lists the three online or most recently seen and a "See all devices (6)" submenu with all six, each still offering Revoke…

### Requirement: Tray popover
A helper that reports popover support (macOS) SHALL show, when the menu bar icon is clicked, a popover with cards instead of the menu, following the system appearance (dark or light), with top to bottom:
- a header with the product mark, "Remote Harness", `machine name · paths · version · since HH:MM` (the paths as in the menu's status line, never an address) and a state pill (running, updating or update available);
- **Waiting for you**, only while a tool permission waits: a card with the agent's badge, the session title, the profile, `Tool · detail` and how long it has waited, and the answers Deny, Always (when the daemon suggested a rule) and Allow, or only Open in terminal (tmux) when "Show permission requests here" is off;
- **Sessions** with the total and running counts: at most 5 live sessions as rows (agent badge, title, `folder · profile · worktree`, a state pill), a click opening the session in the terminal (tmux) when it is controllable and a context menu with Open in terminal (tmux), Rename… and Close session; "See all sessions…" when more are live and a row with the ended count, both opening the Sessions window; "No sessions" when there are none;
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
