## MODIFIED Requirements

### Requirement: Terminal in the app
The Terminal tab SHALL render the frames in a terminal emulator using the app theme, with a key bar (arrows, Enter, Esc, Tab, Shift+Tab, Ctrl+C, 1-9). The app SHALL be subscribed to the pane only while the terminal can be seen: its screen, or the session screen that holds the tablet inspector showing it, is focused and the app is in the foreground. It SHALL draw at most one frame per display frame, the latest, and redraw only the rows that changed unless the pane size changed.

#### Scenario: Navigate a menu
- **WHEN** the user taps the down arrow and Enter
- **THEN** the app sends `session.key` `Down` and `Enter` and the next frame shows the selection

#### Scenario: Hidden terminal
- **WHEN** the terminal screen is covered by another screen, or the app goes to the background
- **THEN** the app sends `pane.unsubscribe`, and subscribes again when the terminal is visible

#### Scenario: Busy pane
- **WHEN** one line of a busy pane changes in a frame
- **THEN** only that row is redrawn in the terminal
