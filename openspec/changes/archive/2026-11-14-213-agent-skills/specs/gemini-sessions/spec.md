## MODIFIED Requirements

### Requirement: Gemini input and commands
Prompts SHALL be pasted into a Gemini pane as one bracketed paste and submitted with Enter at least 250 ms later; with the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Gemini slash commands SHALL be offered for Gemini sessions, with menus (`/model`, `/resume`, `/settings`, …) marked interactive. The custom commands SHALL be offered too: `commands/**/*.toml` in the profile's config folder (`source: "profile"`) and in the project's `.gemini/` (`source: "project"`), named by their path with `:` and described by their `description` field (else the first line of their `prompt`). Gemini skills MUST NOT be listed: the model activates them, and no slash command runs one.

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Gemini session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 250 ms later

#### Scenario: Namespaced project command
- **WHEN** the project has `.gemini/commands/git/commit.toml` with `description = "Write the commit"`
- **THEN** the session's list contains `/git:commit` described "Write the commit", with `source: "project"`

#### Scenario: Skill left out
- **WHEN** the profile's config folder has `skills/review/SKILL.md`
- **THEN** the list has no `review`
