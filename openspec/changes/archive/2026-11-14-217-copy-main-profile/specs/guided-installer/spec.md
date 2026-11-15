## ADDED Requirements

### Requirement: Main profile configuration for a new profile
When `remote-harness setup` creates a Claude Code profile (a new account, or an OpenRouter profile) in a folder other than `~/.claude`, and `~/.claude` exists, it SHALL offer, before the login, a checklist of what to bring from `~/.claude`, every item checked: settings (`settings.json`), memory (`CLAUDE.md`), skills, commands, agents (the `skills/`, `commands/` and `agents/` folders), plugins (`plugins/installed_plugins.json` and `plugins/known_marketplaces.json`; `enabledPlugins` comes with the settings) and MCP servers (the `mcpServers` of `~/.claude.json`, merged into the new folder's `.claude.json`). One more item, unchecked by default, SHALL link skills, commands and agents to `~/.claude` instead of copying them: a folder the new profile does not have yet becomes a symlink to the main one (so later additions show in both), and in a folder it already has, each missing entry is linked. Unchecking every item MUST leave the folder as setup made it. The copy is one-time and MUST NOT bring `.credentials.json`, `oauthAccount` or any other key of `.claude.json` but `mcpServers`, `history.jsonl`, `projects/` or any other file not listed here. Writing SHALL be read → merge → backup → atomic write and idempotent, and MUST NOT overwrite what the new profile already has: an existing settings key or MCP server keeps its value, an existing file, folder or folder entry stays. The daemon's hooks and status line wrapper MUST be removed from the copied settings; setup installs them for the new profile like for every profile. Setup SHALL print what it copied, linked or left as it was. All texts MUST be translated (pt-BR, en-US, es-ES).

#### Scenario: Copy into a new account
- **WHEN** the user creates the account `~/.claude-work`, keeps every item checked and logs in
- **THEN** `~/.claude-work` has the settings of `~/.claude` (with the profile's own hooks), its `CLAUDE.md`, skills, commands, agents and plugin lists, its `.claude.json` has the MCP servers of `~/.claude.json`, and it has no `.credentials.json`, history or `projects/` from `~/.claude`

#### Scenario: Link instead of copy
- **WHEN** the user also checks the link item
- **THEN** `~/.claude-work/skills`, `commands` and `agents` are symlinks to the folders of `~/.claude`, and a skill added to `~/.claude/skills` later shows in sessions of the new profile

#### Scenario: Decline
- **WHEN** the user unchecks every item
- **THEN** nothing is copied and the folder stays empty until the login

#### Scenario: Existing content wins
- **WHEN** the new folder already has a `settings.json` with `"model": "opus"` and an MCP server `github`, and `~/.claude` has `"model": "sonnet"`, `"theme": "dark"` and a different `github` server
- **THEN** the new `settings.json` keeps `"model": "opus"` and gains `"theme": "dark"`, the new `github` server is unchanged, and the previous `settings.json` is kept as a backup

#### Scenario: Twice
- **WHEN** the copy runs again on the same folder
- **THEN** nothing changes and no file is written

#### Scenario: Skills in the app
- **WHEN** a session of the new profile is started from the app after the copy
- **THEN** its `/` list shows the copied skills under Profile
