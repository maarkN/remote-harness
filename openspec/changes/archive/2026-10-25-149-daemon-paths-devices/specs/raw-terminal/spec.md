## MODIFIED Requirements

### Requirement: Pane stream
After `pane.subscribe`, the daemon SHALL send the visible pane content including color sequences only when it changes, at most 4 times per second: a full `pane.frame { sessionId, text, cols, rows }` to a new viewer and whenever the size changes or most lines changed, and otherwise `pane.diff { sessionId, cols, rows, lineCount, scroll?, lines }` with how many lines the screen scrolled up (a growing log) and only the lines that still differ (`[index, text]`), which the app applies to its last frame. `pane.unsubscribe` or disconnection MUST stop the capture.

#### Scenario: Menu open
- **WHEN** the TUI opens the `/model` menu
- **THEN** the app receives a frame or diff with the menu

#### Scenario: Idle pane
- **WHEN** the content does not change
- **THEN** no new frame is sent

#### Scenario: One line of output
- **WHEN** a running command prints one new line in a 40-line pane
- **THEN** the viewers receive a `pane.diff` with the changed lines instead of the whole screen

#### Scenario: Second viewer
- **WHEN** another device subscribes to a pane that is already streaming
- **THEN** that device first receives a full `pane.frame`
