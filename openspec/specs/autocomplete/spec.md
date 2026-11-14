# autocomplete Specification

## Purpose
Offers in the app file (`@`) and skill/command (`/`) suggestions equivalent to those in the Claude Code TUI.

## Requirements

### Requirement: File search
`files.search { sessionId, query, limit }` SHALL return up to `limit` (default 20) files and folders from the session's `cwd` that fuzzy-match `query`, ignoring whatever `.gitignore` excludes.

#### Scenario: Partial search
- **WHEN** the app searches "mainap" in a session with `src/main/app.ts`
- **THEN** the result includes `src/main/app.ts` with `kind: "file"`

#### Scenario: Folders
- **WHEN** the app searches "src/comp"
- **THEN** the result includes `src/components/` with `kind: "dir"`

#### Scenario: node_modules ignored
- **WHEN** `node_modules` is in `.gitignore`
- **THEN** no path inside it appears

### Requirement: Command list
`commands.list { sessionId }` SHALL return commands with `name`, `description`, `source` (`builtin`, `profile`, `project`, `plugin`) and `prefix` (`/` or `$`, default `/`: the character typed before the name to run it), for the session's agent. For Claude Code they are read from the frontmatter of `skills/*/SKILL.md` and `commands/**/*.md` in the profile, the project (`.claude/`) and the profile's installed plugins, plus the table of built-ins. For Codex, Gemini CLI, Kimi CLI and Qwen Code they are the CLI's built-in table plus the skills and custom commands of the profile and the project, read from the folders each CLI reads (named in that agent's requirements) and named the way the CLI runs them; a nested command file is named by its path with `:` (`git/commit` → `git:commit`). On a name clash the first source wins: project, then profile, then plugins, then built-ins. Symlinks SHALL be followed: a symlinked skill folder or command file (or a symlinked folder of commands) is read like a real one, a broken link is skipped and a link loop MUST NOT stop the list from returning. The list's change detector SHALL cover every folder the list is read from, so a new skill or command is in the next list. The built-in table of each agent SHALL match the current CLI (the version it was checked against is named in the table), have no duplicate names, and leave out commands that would cut the remote control off or only concern the local terminal (such as `/logout`, `/remote-control`, `/terminal-setup`).

#### Scenario: Project skill
- **WHEN** the project has `.claude/skills/deploy/SKILL.md` with `name: deploy`
- **THEN** the list contains `/deploy` with `source: "project"`

#### Scenario: Symlinked skill
- **WHEN** the profile's `skills/review` is a symlink to a folder with `SKILL.md` (`name: review`)
- **THEN** the list contains `/review` with `source: "profile"`

#### Scenario: Broken symlink
- **WHEN** the profile's `skills/gone` is a symlink to a folder that no longer exists
- **THEN** the list is returned without it and without an error

#### Scenario: Cache invalidated
- **WHEN** a new `SKILL.md` is created in the profile
- **THEN** the next call already includes it

#### Scenario: Cache invalidated for another agent
- **WHEN** a Kimi session listed its commands and a new skill folder is added to `~/.kimi/skills`
- **THEN** the next call already includes `/skill:<name>`

#### Scenario: Native command
- **WHEN** the app lists commands of a Claude Code session
- **THEN** the list contains `/rename`, `/add-dir` and `/tasks` with `source: "builtin"`

#### Scenario: Project wins over profile
- **WHEN** a Qwen session's project and profile both have a command named `review`
- **THEN** the list has one `review`, with `source: "project"`

### Requirement: Suggestions in the app
When typing `@` or `/` (at the start of the prompt for `/`), the app SHALL show suggestions above the keyboard, updating with a 150 ms debounce for files, and insert `@path` or the command's prefix and name followed by a space (`/name `, or `$name ` for a command whose `prefix` is `$`) on tap. For `/` with no query it SHALL list every command, with no item limit, grouped in sections in this order: *Recent*, *Built-in*, *Project*, *Profile*, *Plugins* (empty sections hidden, a recent command not repeated in its own section). The *Profile* header SHALL name the session's profile folder (`Profile · ~/.claude-work`), so the personal skills listed are visibly those of the session's profile. With a query it SHALL show one list ranked by name prefix, then name substring, then fuzzy (subsequence) match on the name, then description match, with recent commands first among equal matches, and highlight the matched characters of the name. Each command row SHALL show the name after its prefix, a one-line description (built-ins translated by name, others in the text the daemon sends), the source badge and an indicator for interactive commands, with a tap target of at least 44 pt. The list height SHALL follow the space left above the keyboard. When nothing matches it SHALL say "no commands match".

#### Scenario: Choose file
- **WHEN** the user types "@app" and taps `src/app.ts`
- **THEN** the text becomes "@src/app.ts "

#### Scenario: Only a slash
- **WHEN** the session has 40 built-ins, 3 project skills and 30 plugin commands and the user types "/"
- **THEN** all 73 commands can be reached by scrolling, under the Built-in, Project and Plugins headers

#### Scenario: Profile folder in the header
- **WHEN** a session of a profile whose config folder is `~/.claude-work` lists its personal skills under "/"
- **THEN** their section header reads "Profile · ~/.claude-work"

#### Scenario: Codex skill
- **WHEN** in a Codex session the user types "/hat" and taps the skill `hatch-pet` (prefix `$`)
- **THEN** the row reads "$hatch-pet" and the text becomes "$hatch-pet "

#### Scenario: Fuzzy match
- **WHEN** the user types "/rnm"
- **THEN** `/rename` is listed with "r", "n" and "m" highlighted

#### Scenario: Prefix first
- **WHEN** the user types "/co" and the list has `compact`, `config`, `context`, `copy` and `deploy-config`
- **THEN** the four commands that start with "co" come before `deploy-config`

#### Scenario: No match
- **WHEN** the user types "/zzzz"
- **THEN** the list shows "no commands match"

### Requirement: Interactive commands
When sending a built-in command marked as interactive (for example `/model`, `/config`, `/permissions`, `/mcp`, `/resume`, `/login`, `/tasks`), the app SHALL send it and open the session's raw terminal.

#### Scenario: /model
- **WHEN** the user sends "/model"
- **THEN** the command is sent and the raw terminal tab opens

### Requirement: Recent commands
The app SHALL remember, per profile and on the device only, the commands sent from it (a prompt that starts with a listed command's prefix and name, `/<name>` or `$<name>`): the name, the last use and a use count, at most 20 per profile. The five most recently used that are in the session's list SHALL form the *Recent* section with no query. "Forget the machine" SHALL clear them.

#### Scenario: Used before
- **WHEN** the user sent "/compact" yesterday in a session of the same profile and now types "/"
- **THEN** `/compact` is the first row, under *Recent*

#### Scenario: Other profile
- **WHEN** the user sent "/compact" only in sessions of another profile
- **THEN** `/compact` is not under *Recent* for this profile

#### Scenario: Codex skill used before
- **WHEN** the user sent "$hatch-pet make a cat" in a Codex session and now types "/" in another session of the same profile
- **THEN** `$hatch-pet` is under *Recent*

### Requirement: Suggestions from the keyboard
While Return sends (a hardware keyboard, or the "Return key sends" setting) and the `@` file or `/` command suggestions are open with at least one row, the first row SHALL be highlighted and kept in view, the highlight SHALL return to the first row whenever the query changes, and Return SHALL accept the highlighted row instead of sending. With a hardware keyboard on iOS and iPadOS, Tab SHALL also accept it, ↑ / ↓ SHALL move the highlight without wrapping, and the caret keys SHALL work normally again once the list closes. Esc SHALL close the list and keep the field focused. With no rows, Return keeps its usual behavior.

#### Scenario: Accept with Return
- **WHEN** a hardware keyboard is in use, the user types `@src` and the list shows three files
- **THEN** the first file is highlighted, and Return inserts it instead of sending the prompt

#### Scenario: Move the highlight
- **WHEN** the command list is open on an iPad with a hardware keyboard and the user presses ↓ twice and then Tab
- **THEN** the third command is inserted

#### Scenario: Last row
- **WHEN** the last row is highlighted and the user presses ↓
- **THEN** the highlight stays on the last row

#### Scenario: Empty list
- **WHEN** the suggestions show no match and the user presses Return with a hardware keyboard
- **THEN** the prompt is sent as typed
