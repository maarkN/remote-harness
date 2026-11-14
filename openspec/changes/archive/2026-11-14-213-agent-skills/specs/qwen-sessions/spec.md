## MODIFIED Requirements

### Requirement: Qwen input and commands
Prompts SHALL be pasted into a Qwen pane as one bracketed paste and submitted with Enter at least 250 ms later; with the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Qwen slash commands SHALL be offered for Qwen sessions, with menus marked interactive and without commands that change the approval mode. The custom commands and skills SHALL be offered too, as `/<name>`: commands are `commands/**/*.md` (or the older `*.toml`) named by their path with `:`, in the profile's config folder (`source: "profile"`) and the project's `.qwen/` (`source: "project"`); skills are `skills/<name>/SKILL.md` one level deep, in the profile's config folder and `~/.agents/skills/` (`source: "profile"`) and in the project's `.qwen/skills/` and `.agents/skills/` (`source: "project"`).

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Qwen session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 250 ms later

#### Scenario: Personal command and skill
- **WHEN** the profile's config folder has `commands/test.md` and `skills/pdf/SKILL.md`
- **THEN** the session's list contains `/test` and `/pdf`, both with `source: "profile"`
