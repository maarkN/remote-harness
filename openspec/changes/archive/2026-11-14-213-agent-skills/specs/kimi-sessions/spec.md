## MODIFIED Requirements

### Requirement: Kimi input and commands
Prompts SHALL be pasted into a Kimi pane as one bracketed paste and submitted with Enter at least 100 ms later; with the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Kimi slash commands SHALL be offered for Kimi sessions, with menus marked interactive and without `/yolo` or `/afk`. Kimi skills SHALL be offered too, as `/skill:<name>` (and also `/flow:<name>` for a skill whose frontmatter says `type: flow`), read where Kimi reads them whatever `KIMI_SHARE_DIR` says: with `source: "profile"`, the brand folders `~/.kimi/skills/`, `~/.claude/skills/` and `~/.codex/skills/` (all of them, Kimi's copy first on a name clash) and the generic `~/.config/agents/skills/` (or `~/.agents/skills/` when it does not exist); with `source: "project"`, the same `.kimi/`, `.claude/`, `.codex/` and `.agents/` skill folders at the project root (the nearest folder with `.git`, else the session's folder).

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Kimi session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 100 ms later

#### Scenario: Personal skill
- **WHEN** `~/.kimi/skills/review/SKILL.md` exists with `name: review`
- **THEN** the session's list contains `/skill:review` with `source: "profile"`

#### Scenario: Flow skill
- **WHEN** a project skill `code-review` says `type: flow`
- **THEN** the list contains `/skill:code-review` and `/flow:code-review`, both with `source: "project"`
