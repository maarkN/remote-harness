## ADDED Requirements

### Requirement: Session terminal window
On macOS, the tray helper SHALL open a **terminal window** for a session that runs in a tmux pane of the Remote Harness tmux server: a window of its own, titled with the session title, that mirrors the pane with the same xterm.js view and frame drawing as the app's Terminal tab, and sends what is typed in it to the session as keys. There SHALL be one window per session: opening it again brings the open one to the front. The daemon SHALL feed the window the same pane stream the app gets (a full frame first, then the changed lines) through the helper's standard input, and receive what is typed through the helper's standard output, typing it into the pane through its input feature with the session's input lock; it MUST NOT open a port, socket or any other channel for it, and MUST NOT log what is typed. The echo of a key SHALL not wait for the next periodic capture. The window SHALL follow the system appearance (the app's dark and light terminal palettes), fit the pane's columns and rows to its size, keep its title in sync with the session title, and support copy, paste and select all with the usual keys. Closing the window MUST leave the session running and stop its stream; the window SHALL close when the session ends or loses its pane. It MUST work with no terminal application open.

#### Scenario: Open and type
- **WHEN** the user clicks a tmux session in the popover and types `/help` and Return in the window that opens
- **THEN** the window shows the session's pane live, titled with the session title, and the session receives `/help` and Return

#### Scenario: Reuse the window
- **WHEN** the window of a session is open behind other windows and the user clicks the session again
- **THEN** the same window comes to the front and no second window opens

#### Scenario: Close the window
- **WHEN** the user closes a session's terminal window
- **THEN** the session keeps running, its pane stream stops if no device watches it, and a later click opens a new window

#### Scenario: No terminal app
- **WHEN** no terminal application is running or installed besides Terminal.app, and the user clicks a tmux session
- **THEN** the terminal window opens and works; no terminal application is started

#### Scenario: Session ends
- **WHEN** the session in an open terminal window ends
- **THEN** the window closes

#### Scenario: Rename
- **WHEN** a session with an open terminal window is renamed
- **THEN** the window title becomes the new name

#### Scenario: Light appearance
- **WHEN** macOS uses the light appearance
- **THEN** the terminal window uses the app's light terminal palette, and switches to the dark one when the appearance changes

## MODIFIED Requirements

### Requirement: Tray popover
A helper that reports popover support (macOS) SHALL show, when the menu bar icon is clicked, a popover with cards instead of the menu, following the system appearance (dark or light), with top to bottom:
- a header with the product mark, "Remote Harness", `machine name · paths · version · since HH:MM` (the paths as in the menu's status line, never an address) and a state pill (running, updating or update available);
- **Waiting for you**, only while a tool permission waits: a card with the agent's badge, the session title, the profile, `Tool · detail` and how long it has waited, and the answers Deny, Always (when the daemon suggested a rule) and Allow, or only Open in terminal (tmux) when "Show permission requests here" is off;
- **Sessions** with the total and running counts: at most 5 live sessions as rows (agent badge, title, `folder · profile · worktree`, a state pill), a click opening the session's terminal window (see "Session terminal window") when it is controllable and a context menu with Open in terminal (tmux), which still opens an external terminal, Rename… and Close session; "See all sessions…" when more are live and a row with the ended count, both opening the Sessions window; "No sessions" when there are none;
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
- **WHEN** the user clicks a session that runs in a tmux pane
- **THEN** its terminal window opens, or comes to the front when already open, and the popover closes

#### Scenario: Open in terminal from the context menu
- **WHEN** the user picks Open in terminal (tmux) in a session row's context menu
- **THEN** the session opens in an external terminal app attached to its pane, as before

### Requirement: Sessions window
On a helper that reports it can open windows (macOS), "See all sessions…" SHALL open a native **Sessions window**: a searchable table of every session (not only the ones shown in the menu) with its name, folder, agent, state and start time, updated live as the daemon's session list changes. Each row SHALL offer Focus (open in terminal/tmux), Rename…, Close session and Copy path; Copy path MUST work without a round trip to the daemon. A double-click on a session that runs in a tmux pane SHALL open its terminal window. The window SHALL filter as the user types, matching the name or the folder.

#### Scenario: Open from the menu
- **WHEN** the user picks "See all sessions…"
- **THEN** the Sessions window opens showing every live and recently ended session, including ones past the menu's cap

#### Scenario: Search
- **WHEN** the user types part of a folder name in the Sessions window's search field
- **THEN** only sessions whose name or folder match stay listed

#### Scenario: Copy path
- **WHEN** the user picks "Copy path" on a row
- **THEN** the folder path is on the clipboard, with no daemon round trip

#### Scenario: Double-click a row
- **WHEN** the user double-clicks a tmux session in the Sessions window
- **THEN** its terminal window opens or comes to the front
