## MODIFIED Requirements

### Requirement: Tray icon
When a supported helper is available (macOS menu bar; Linux AppIndicator), the service daemon SHALL show a tray icon whose glyph encodes only the state: the mark as a template image when idle, the ring filled while any session works, an amber dot (the only color) while a permission waits, and 40 % opacity when the daemon is gone. A helper that shows menus (Linux, and macOS only if the popover is unavailable) SHALL show, top to bottom: the status (`machine name · paths · version · since HH:MM`, where the paths say whether devices reach the computer by the direct path, the relay path, both or neither — never an address); **Waiting for you** with the oldest pending tool permission (`session title · Tool · detail`) and Allow, Always allow (when the daemon suggested a rule, saved like the app does), Deny and Open in terminal (tmux); **Sessions** by recency, each as `title · state` with its folder, profile and worktree, Open in terminal (tmux), Rename… and Close session (the graceful close), the ended ones collapsed in one submenu; **Devices** with whether push is on and each paired device as `name · online (path)` or `name · offline`, whose submenu shows when it paired and "Revoke…", a nested confirmation that revokes the device like `remote-harness devices revoke`; New session…, Pair a phone…, Open the docs and Preferences…; then "Check for updates", "Update now" (when an update is available), the automatic updates toggle, the channel choice, "Open logs", "Restart daemon" (under a service manager), "Run doctor" and "Quit tray". The menu SHALL refresh on session, permission and device changes (a device connecting, disconnecting, pairing or being revoked). A helper that reports it can open windows (macOS) SHALL list at most 5 live sessions before a trailing "See all sessions…" item; a helper without window support (Linux; Windows) keeps listing up to 8. Without a helper the daemon MUST keep working headless. `tray: false` in the config SHALL disable it. All labels MUST be translated. The popover has its own requirement, as do Pair a phone, Preferences, the Sessions window and rename.


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

### Requirement: Tray preferences
On a helper that reports it can open windows (macOS), the tray's "Preferences…" SHALL open a native **Preferences window** instead of the config file, with tabs in this order:
- **General**: machine name (free text, shown elsewhere as the machine's display name), "Show in menu bar" (the `tray` config), "Show permission requests here" (`trayPermissions`), "Start at login" (installs or removes the login service), and the keep-awake mode.
- **Profiles**: one group per configured profile with its name as an editable text field, and its agent and config folder read-only.
- **Notifications**: "Push notifications & live status" (the `push` setting; its hint SHALL say it covers both), and a line pointing to the app for per-session mute rules.
- **Network**: whether the direct path is on and the addresses it advertises, whether the connection relay is on and the home relay (or that none answers yet), and how many devices are connected now by each path.
- **Devices**: each paired device with its platform, when it paired, when it was last seen, whether it is online now and by which path, and "Revoke…", which asks for confirmation and then revokes it like `remote-harness devices revoke`.
- **Pairing**: the pairing QR code and address and "Show the pairing in the terminal", the same actions as the menu's Pair a phone submenu.
- **Updates**: the update channel, the automatic updates toggle and "Check for updates now", reflecting the same state and actions as the existing menu items.
- **Advanced**: "Open the config file…", "Open the logs folder" and "Run doctor".

Every change SHALL be written to the config file (read → merge → backup → atomic write) and applied without restarting the daemon, like the rest of the tray's settings; a renamed profile shows its new name in the tray right away and in the app after the daemon's next start (the profiles it is given are fixed for the process's lifetime, like the rest of `hello`). An empty profile name SHALL be refused. A helper without window support (Linux; Windows) keeps "Preferences…" opening the config file directly.


#### Scenario: Turn push off from the menu bar
- **WHEN** the user turns off "Push notifications & live status" in the Preferences window
- **THEN** the config has `push: "off"` and the daemon sends no more pushes or live status until it is turned on again

#### Scenario: Permissions only in the app
- **WHEN** "Show permission requests here" is off and a permission waits
- **THEN** the menu shows the waiting request with Open in terminal and no Allow / Deny

#### Scenario: Rename the machine
- **WHEN** the user types a new machine name in the General tab
- **THEN** the config's `machineName` is updated, the tray's own status line reflects it right away, and the app, push and live status show the new name after the daemon's next start (the host name they are given is fixed for the process's lifetime, like the rest of `hello`)

#### Scenario: Start at login
- **WHEN** the user turns on "Start at login" under a service manager
- **THEN** the login service is installed, and off removes it

#### Scenario: No window support
- **WHEN** the helper does not report window support
- **THEN** "Preferences…" opens the config file, as before


#### Scenario: Rename a profile
- **WHEN** the user changes the "Work" profile's name to "Acme" in the Profiles tab
- **THEN** the config file's profile with that id has the name "Acme" and the tray's session rows show "Acme" right away

#### Scenario: Network tab
- **WHEN** the connection relay is on but no relay answers yet
- **THEN** the Network tab shows the connection relay as on with no home relay yet, and the direct path with its addresses

#### Scenario: Revoke from Preferences
- **WHEN** the user picks Revoke… on a device in the Devices tab and confirms
- **THEN** the device is revoked and disappears from the tab, the popover and the menu

## ADDED Requirements

### Requirement: Tray popover
A helper that reports popover support (macOS) SHALL show, when the menu bar icon is clicked, a popover with cards instead of the menu, following the system appearance (dark or light), with top to bottom:
- a header with the product mark, "Remote Harness", `machine name · paths · version · since HH:MM` (the paths as in the menu's status line, never an address) and a state pill (running, updating or update available);
- **Waiting for you**, only while a tool permission waits: a card with the agent's badge, the session title, the profile, `Tool · detail` and how long it has waited, and the answers Deny, Always (when the daemon suggested a rule) and Allow, or only Open in terminal (tmux) when "Show permission requests here" is off;
- **Sessions** with the total and running counts: at most 5 live sessions as rows (agent badge, title, `folder · profile · worktree`, a state pill), a click opening the session in the terminal (tmux) when it is controllable and a context menu with Open in terminal (tmux), Rename… and Close session; "See all sessions…" when more are live and a row with the ended count, both opening the Sessions window; "No sessions" when there are none;
- **Devices** with whether push is on: each paired device with when it paired and whether it is online now (and by which path) or offline, a click opening the Devices tab of the Preferences window; a hint to pair one when there are none;
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
