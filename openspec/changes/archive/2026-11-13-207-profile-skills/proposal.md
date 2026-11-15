## Why

In a Claude Code session opened from the app, the personal skills of the profile's config dir were missing from the app's `/` list (#538). Reproduced on macOS with the default profile (`~/.claude`): 86 skills sit in `~/.claude/skills`, 75 of them as symlinks to folders elsewhere (skills installed by a skill manager link their folder in), and the daemon's command list skips every one of them, because it only descends into entries that are directories themselves and a symlink to a directory is not one. Claude Code itself follows the links, so the agent sees the skills while the app does not. Symlinked command files (`commands/*.md` linked in) are skipped the same way.

The second half of the report, "the agent cannot use them", comes from the profile, not from a bug: the session opened from the app ran with the `Imobitech` profile (`~/.claude-imobitech`), whose personal skills are only the ones claude.ai syncs, while the terminal uses `~/.claude`. Checked in the Remote Harness tmux server: the pane runs with `HOME=/Users/hanna` and `CLAUDE_CONFIG_DIR=/Users/hanna/.claude-imobitech`, exactly the profile's dir, so the environment of the service-started tmux server is not the cause. The app already shows each profile's folder in the New session list and in Settings → Profiles, but not where the user looks for a missing skill: the `/` list.

The other hypotheses of the issue do not hold: submitting `/name args` pastes the text and presses Enter with no `Escape` (the paste strategy, the default, never closes a menu first), and the list's cache already re-reads nested edits within its 60 s TTL.

## What Changes

- The command list follows symlinks: a symlinked skill folder (at any of the levels already searched) and a symlinked command file or folder are read like real ones, from the profile, the project and the plugins. A broken link is skipped, and a link loop cannot hang the read (the search keeps its depth bound). The same list serves sessions started from the app and sessions started on the computer and attached.
- The app's `/` list titles the Profile section with the profile's folder (`Profile · ~/.claude-imobitech`), so a session's personal skills are visibly those of its profile.
- The docs (Using the app → Sending prompts, in the three languages) say where `/` commands come from per agent: for Claude Code the project's `.claude/`, the profile's config folder (`skills/`, `commands/`, symlinks included) and its installed plugins, plus the built-ins; for Codex, Gemini CLI, Kimi CLI and Qwen Code the CLI's own commands.
- Tests: the loader with profile, project and plugin layouts including nested folders and symlinks; the input service submitting `/skill args` as typed.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `autocomplete`: "Command list" reads symlinked skills and commands; "Suggestions in the app" titles the Profile section with the profile's folder.

## Impact

- Daemon: `features/autocomplete/commands.ts` and its tests; a new input test.
- App: the `/` suggestion list's section header, a new i18n key in the three catalogs.
- Docs: `apps/web/content/*/using-the-app.md`.
- No protocol change.
