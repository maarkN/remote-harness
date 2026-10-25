# raw-terminal Specification

## Purpose
Mirrors the raw content of the session's tmux pane in the app, as a fallback for TUI menus and dialogs.

## Requirements

### Requirement: Pane stream
After `pane.subscribe`, the daemon SHALL send `pane.frame { sessionId, text, cols, rows }` with the visible pane content including color sequences, only when the content changes, at most 4 times per second. `pane.unsubscribe` or disconnection MUST stop the capture.

#### Scenario: Menu open
- **WHEN** the TUI opens the `/model` menu
- **THEN** the app receives a frame with the menu

#### Scenario: Idle pane
- **WHEN** the content does not change
- **THEN** no new frame is sent

### Requirement: Terminal in the app
The Terminal tab SHALL render the frames in a terminal emulator using the app theme, with a key bar (arrows, Enter, Esc, Tab, Shift+Tab, Ctrl+C, 1-9). The app SHALL be subscribed to the pane only while the terminal can be seen: its screen, or the session screen that holds the tablet inspector showing it, is focused and the app is in the foreground. It SHALL draw at most one frame per display frame, the latest, and redraw only the rows that changed unless the pane size changed. Characters a platform cannot draw as a one-column text glyph SHALL be drawn as a same-width substitute from one table (`⏺` as `●`, `⏵` as `►`, `⎿` as `└`). In the tablet inspector the key bar SHALL show every key at once, wrapping into as many rows as its width needs; the full-screen terminal keeps one scrolling row.

#### Scenario: Navigate a menu
- **WHEN** the user taps the down arrow and Enter
- **THEN** the app sends `session.key` `Down` and `Enter` and the next frame shows the selection

#### Scenario: Hidden terminal
- **WHEN** the terminal screen is covered by another screen, or the app goes to the background
- **THEN** the app sends `pane.unsubscribe`, and subscribes again when the terminal is visible

#### Scenario: Busy pane
- **WHEN** one line of a busy pane changes in a frame
- **THEN** only that row is redrawn in the terminal

#### Scenario: Mode line on Android
- **WHEN** Claude Code's mode line reads `⏵⏵ accept edits on` on an Android device
- **THEN** the terminal shows `►► accept edits on`, with no boxes

#### Scenario: Key bar in the tablet inspector
- **WHEN** the inspector shows the Terminal tab on a tablet
- **THEN** every key of the key bar is visible, in several rows, and none is cut at the screen edge

### Requirement: Focus the pane
`pane.focus { sessionId }` SHALL select the session's tmux window and pane on the computer (`select-window` then `select-pane`) and reply `ack`; a session without a live pane MUST be rejected with `not_controllable`. The daemon does not raise the terminal application.

#### Scenario: Focus from the tray
- **WHEN** the tray asks to focus a controllable session
- **THEN** tmux switches to that session's window and pane

#### Scenario: Read-only session
- **WHEN** `pane.focus` names a session without a pane
- **THEN** the reply is `error` `not_controllable`
