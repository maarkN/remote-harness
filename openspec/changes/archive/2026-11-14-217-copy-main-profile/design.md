## Context

`remote-harness setup` creates Claude Code profiles in two places: "Create a new account" (`createAccount`, which then opens `claude` for the login) and "Add an OpenRouter profile" (`createProviderProfile`, no login). Both make an empty folder. The main profile is `~/.claude`, whose `.claude.json` (login, MCP servers, per-project state) lives at `~/.claude.json`; a profile with its own folder keeps it at `<folder>/.claude.json`.

## Goals / Non-Goals

**Goals:** a new profile can start with the user's configuration, without ever carrying the login, credentials or history; the user can keep skills, commands and agents in sync with the main profile.

**Non-Goals:** the same offer for Codex, Gemini CLI, Kimi CLI and Qwen Code profiles; an offer from the app; keeping settings or MCP servers in sync (they are copied once).

## Decisions

- **Named items, not a folder copy.** The copy lists what it brings (settings, `CLAUDE.md`, three folders, two plugin lists, `mcpServers`); everything else, login and history included, is out by construction. Alternative: copy the folder minus a deny list — rejected, a new Claude Code file would leak by default.
- **One checklist, link as its last item.** The user asked for a one-time copy with a checkbox to link to the main profile instead. One `checkbox` prompt holds both: the items (checked) and "link skills, commands and agents instead of copying" (unchecked). Linking only applies to those three folders: settings and `.claude.json` mix in per-profile state (hooks, login), so a link would make two profiles share it.
- **Link the folder when missing, its entries otherwise.** A folder symlink keeps later additions in sync, which is the point of linking; when the new profile already has the folder, linking each missing entry is the only way that does not overwrite anything.
- **Settings merged by top-level key, the new profile winning.** Without our hooks and status-line wrapper (the installer adds the new profile's own afterwards). A deeper merge (e.g. `permissions.allow`) would mix rules the user set per profile; a key the new profile has stays whole.
- **MCP servers merged by name** into `<folder>/.claude.json`, reading only `mcpServers` of `~/.claude.json`.
- **Before the login.** The login run already sees the user's settings, and an OpenRouter profile (no login) gets the same offer at the same point.

## Risks / Trade-offs

- A copied plugin list points at the main profile's plugin cache (absolute `installPath`s): removing a plugin from `~/.claude` breaks it in the copy → the docs say so; reinstalling in the new profile fixes it.
- Linked folders are shared: deleting a skill in one profile deletes it in both → the checklist item says they stay in sync, and the ADR records the choice.
