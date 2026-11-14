---
status: accepted
---

# A new profile may link its skills, commands and agents to the main profile

A Claude Code profile with its own config folder (`CLAUDE_CONFIG_DIR`) starts empty: none of the user's settings, memory, skills, commands, agents, plugins or MCP servers from `~/.claude`, so a new account behaves like a fresh install on the computer and in sessions started from the app. We decided that `remote-harness setup`, when it creates a profile, offers to bring that configuration in once, as a list of named items (never a folder copy, so the login, credentials, history and per-project state stay out by construction), and, as an opt-in, to **link** the `skills/`, `commands/` and `agents/` folders to the main profile's instead of copying them: a folder the new profile lacks becomes a symlink to `~/.claude`'s, and in a folder it already has each missing entry is linked. Linked content is shared: a skill added in either profile shows in both, and one deleted in either is gone from both.

Linking stops at those three folders because they hold only content the user curates. Settings and `.claude.json` mix in per-profile state (the daemon's hooks and status line, the login, project trust), so they are copied once and merged by key, the new profile's values winning; a link there would make two accounts share a login. We rejected a one-time copy with no link, the simplest and what the issue first proposed, because the user wants their skills to follow them into every account without running the copy again; and linking whole profiles (or `settings.json`), because that shares exactly the per-profile state profiles exist to keep apart. The cost is that a profile's skills can change because of another profile, which the setup's checklist says next to the option.
