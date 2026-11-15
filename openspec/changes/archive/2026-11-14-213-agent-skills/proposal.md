## Why

Only the Claude Code adapter reads skills and commands from disk; the Codex, Gemini CLI, Kimi CLI and Qwen Code adapters answer their built-in table only (`commands: async () => <TABLE>`, `commandsSignature: async () => 'builtin'`), so the personal and project skills and custom commands of those CLIs never reach the app's `/` list (#537). Each CLI reads them from different folders and runs them with a different syntax, which the issue only assumed from the docs:

- **Codex** (checked on codex 0.166 on the computer): skills in `$CODEX_HOME/skills/<name>/SKILL.md` (bundled ones under `skills/.system/`), `~/.agents/skills/`, and `.agents/skills/` or `.codex/skills/` from the session's folder up to the repository root. A skill runs with a `$name` mention, not a slash command: the TUI's `/` popup has no skills (they open with `$`), and there are no `/prompts:` custom prompts any more (`/presets` replaced them).
- **Gemini CLI** (gemini-cli docs, v0.67): custom commands are `commands/**/*.toml` in the config folder and in the project's `.gemini/`, named by path (`git/commit.toml` → `/git:commit`). Its skills are activated by the model (`activate_skill`), never by a slash command, so they have no place in the `/` list.
- **Kimi CLI** (kimi-cli docs): skills run as `/skill:<name>` (flow skills also as `/flow:<name>`). They are read regardless of `KIMI_SHARE_DIR`: the brand folders `~/.kimi/skills/`, `~/.claude/skills/` and `~/.codex/skills/` (all merged, Kimi's copy first), the generic `~/.config/agents/skills/` (else `~/.agents/skills/`), and the same `.kimi/`, `.claude/`, `.codex/` and `.agents/` folders at the project root (the nearest `.git` ancestor).
- **Qwen Code** (qwen-code docs): custom commands are `commands/**/*.md` (and the older `.toml`) in the config folder and the project's `.qwen/`, named by path; skills are `skills/<name>/SKILL.md` in the config folder, `~/.agents/skills/` and the project's `.qwen/` or `.agents/`, one level deep, and run as `/<name>`.

## What Changes

- Each adapter's `commands()` returns its built-ins plus the profile's and the project's skills and commands, read from the folders above with the name the CLI runs them by (`skill:review` for Kimi, `git:commit` for nested commands), the right `source`, symlinks followed as for Claude Code, and the first source winning on a name clash (project, then profile, then built-in). Codex's bundled `.system` skills are listed as built-ins.
- `commandsSignature` covers those folders (their mtimes), so a new skill shows on the next list as it does for Claude Code.
- `CommandItem` gains `prefix` (`/` or `$`, default `/`): the character typed before the name to run it. Codex skills carry `$`; the app inserts and shows `$name` for them, counts them as recent when a prompt starts with `$name`, and keeps every other command on `/`. Older apps ignore the field.
- The shared readers (skill folders, Markdown and TOML command files, folder signatures) move out of the Claude Code loader into one module the five adapters use; the Claude Code list is unchanged.
- Docs: Using the app → Sending prompts lists, per agent, where skills and commands are read from and how they run.
- Tests per adapter with fixture folders.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `autocomplete`: "Command list" covers every agent and the `prefix`; "Suggestions in the app" inserts and shows the prefix; "Recent commands" counts `$name`.
- `codex-sessions`: "Codex input" offers the Codex skills as `$name`.
- `gemini-sessions`: "Gemini input and commands" offers the custom TOML commands.
- `kimi-sessions`: "Kimi input and commands" offers the skills as `/skill:<name>`.
- `qwen-sessions`: "Qwen input and commands" offers the custom commands and skills.

## Impact

- Protocol: optional `prefix` on `CommandItemSchema` (default `/`, backward compatible).
- Daemon: `features/autocomplete/` (a shared reader module, one loader per agent), `features/agents/{codex,gemini,kimi,qwen}.ts`, tests.
- App: `features/autocomplete/trigger.ts`, `recents.ts`, `SuggestionList.tsx` and their tests.
- Docs: `apps/web/content/*/using-the-app.md`.
- Out of scope: Gemini extension commands, Codex plugin skills and Codex `/presets` (stored in its config, not as files).
