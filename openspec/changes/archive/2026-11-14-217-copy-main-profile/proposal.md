## Why

Creating a new Claude Code profile in `remote-harness setup` ("Create a new account", or an OpenRouter profile) makes an empty folder and opens `claude` there to log in (#556). Nothing of the main `~/.claude` comes along: `settings.json`, the memory (`CLAUDE.md`), skills, commands, agents, plugins and the user-scoped MCP servers are missing, so the new profile behaves like a fresh install, on the computer and in sessions started from the app, whose `/` list reads skills from the profile's own folder. Setup then writes only our hooks into that folder's `settings.json`. Today the new-account step only asks for a folder and a login.

## What Changes

- When setup creates a Claude Code profile (a new account or an OpenRouter profile) and `~/.claude` exists, it offers to bring the main profile's configuration in, as a checklist of what comes along (all checked): settings, memory, skills, commands, agents, plugins and MCP servers. One more item, unchecked by default, **links** skills, commands and agents to `~/.claude` instead of copying them, so they stay in sync. Unchecking everything declines: the folder stays empty, as today.
- The copy is one-time and never brings the login or credentials (`.credentials.json`, `oauthAccount` and anything else in `.claude.json` but `mcpServers`), the session history, per-project state or caches; it is a list of named items, not a folder copy.
- Every write follows read → merge → backup → atomic write, is idempotent and never overwrites what the new profile already has: settings keys and MCP servers it already has win, existing files and folders stay. Our hooks and status line are stripped from the copied settings and installed for the new profile afterwards, as for any profile.
- **Profile** enters `GLOSSARY.md`; an ADR records that a profile may link those folders to the main one.
- Setup texts in pt-BR, en-US and es-ES; docs (Getting started → profiles, Daemon → setup).
- Out of scope: the same offer for Codex, Gemini CLI, Kimi CLI and Qwen Code profiles, and offering it from the app (would need a new message).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `guided-installer`: new requirement "Main profile configuration for a new profile".

## Impact

- Daemon: a new `features/setup/profile-copy.ts` (pure merges + the copy), the wizard's new-account and OpenRouter steps, the CLI message catalogs, tests.
- Docs: `GLOSSARY.md`, a new ADR, `apps/web/content/*/getting-started.md` and `daemon.md`.
- No protocol or app change.
