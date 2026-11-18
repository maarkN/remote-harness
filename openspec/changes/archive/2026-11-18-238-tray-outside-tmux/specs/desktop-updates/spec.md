## ADDED Requirements

### Requirement: Sessions outside tmux in the tray
A live session that has no tmux pane on the Remote Harness tmux server (it was started outside it, for example with the agent's own command in a terminal) cannot be opened, focused or closed from the tray, and the tray SHALL say so instead of ignoring the user. In the macOS popover its row SHALL show the title in the secondary color, an "outside tmux" tag next to its state pill and a tooltip explaining that it was started outside Remote Harness's tmux, so there is no terminal to open from here, and that sessions started with a profile's command can be opened; clicking it SHALL do nothing, and its context menu SHALL keep Open in terminal (tmux) and Close session disabled and Rename… available. The Sessions window SHALL show the same tag and tooltip on such a row, with Focus and Close disabled. A helper that shows menus SHALL label such a session `title · state · outside tmux` and start its submenu with the explanation as a disabled line. Sessions in tmux MUST keep opening as before, and ended sessions MUST NOT be tagged. The tag and the explanation MUST be translated.

#### Scenario: Session started with plain claude
- **WHEN** a session started with `claude` in Ghostty, outside the Remote Harness tmux server, is the most recent live session
- **THEN** the popover's first row shows it with a muted title, the "outside tmux" tag and the explaining tooltip, and clicking it does nothing

#### Scenario: Session in tmux
- **WHEN** a session started with a profile's launcher is listed next to one outside tmux
- **THEN** its row has no tag, and clicking it opens the session as before

#### Scenario: Plain menu
- **WHEN** the helper shows menus (Linux) and a live session is outside tmux
- **THEN** its item reads `<title> · running · outside tmux` and its submenu starts with the disabled explanation, with Open in terminal (tmux) and Close session disabled

#### Scenario: Ended session
- **WHEN** a session ended (its pane closed)
- **THEN** it is not tagged "outside tmux"

#### Scenario: Translated
- **WHEN** the daemon's language is pt-BR
- **THEN** the tag reads "fora do tmux"
