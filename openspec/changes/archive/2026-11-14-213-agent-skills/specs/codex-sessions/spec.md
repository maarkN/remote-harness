## MODIFIED Requirements

### Requirement: Codex input
Prompts SHALL be pasted into a Codex pane as one bracketed paste and submitted with Enter at least 250 ms later, so Codex does not take the Enter as part of the paste. With the `type` strategy, line breaks SHALL be sent as `C-j`. Built-in Codex slash commands SHALL be offered for Codex sessions, with `/model`, `/permissions`, `/resume` and the other menus marked interactive. Codex skills SHALL be offered too, with prefix `$` (Codex runs a skill from a `$name` mention, not a slash command): `source: "profile"` for `$CODEX_HOME/skills/` (the profile's config folder) and `~/.agents/skills/`, `source: "project"` for `.agents/skills/` and `.codex/skills/` in the session's folder and each parent up to the repository root, and `source: "builtin"` for the skills bundled under `skills/.system/`. Changing the permission mode of a Codex session follows "Codex permissions from the app".

#### Scenario: Submit after paste
- **WHEN** the app sends "continue" to a Codex session with `pasteEnterDelayMs` 80
- **THEN** the daemon pastes the text and presses Enter 250 ms later

#### Scenario: Personal skill
- **WHEN** the profile's config folder has `skills/hatch-pet/SKILL.md` with `name: hatch-pet`
- **THEN** the session's command list contains `hatch-pet` with `prefix: "$"` and `source: "profile"`

#### Scenario: Repository skill from a subfolder
- **WHEN** a Codex session runs in `<repo>/apps/web` and `<repo>/.agents/skills/release/SKILL.md` exists
- **THEN** the list contains `release` with `prefix: "$"` and `source: "project"`
