## MODIFIED Requirements

### Requirement: Terminal in the app
The Terminal tab SHALL render the frames in a terminal emulator using the app theme, with a key bar (arrows, Enter, Esc, Tab, Shift+Tab, Ctrl+C, 1-9). The app SHALL be subscribed to the pane only while the terminal can be seen: its screen, or the session screen that holds the tablet inspector showing it, is focused and the app is in the foreground. It SHALL draw at most one frame per display frame, the latest, and redraw only the rows that changed unless the pane size changed. Characters a platform cannot draw as a one-column text glyph SHALL be drawn as a same-width substitute from one table (`⏺` as `●`, `⏵` as `►`, `⎿` as `└`). In the tablet inspector the key bar SHALL show every key at once, wrapping into as many rows as its width needs; the full-screen terminal keeps one scrolling row. A session that is not controllable (it has no tmux pane, such as an ended session) SHALL NOT be subscribed to: its terminal, on the full screen and in the tablet inspector, SHALL show a translated read-only state saying it has no terminal on the computer and that its conversation is kept, with the Resume action the conversation offers, and no key bar; once the session is resumed and controllable again, the terminal SHALL subscribe and show the pane.

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

#### Scenario: Ended session
- **WHEN** the user opens the Terminal of an ended session (on the iPhone's Terminal screen or the iPad inspector), with the app in pt-BR
- **THEN** no `pane.subscribe` is sent, the terminal shows the read-only state in Portuguese with **Retomar**, no error from the daemon is shown and no key bar is drawn

#### Scenario: Key bar in the tablet inspector
- **WHEN** the inspector shows the Terminal tab on a tablet
- **THEN** every key of the key bar is visible, in several rows, and none is cut at the screen edge
