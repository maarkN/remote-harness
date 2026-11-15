## Why

A Claude Code session started from the app could not be found with `claude -r` on the computer (#553). Reproduced on macOS with Claude Code 2.1.318 and the default profile (`~/.claude`), starting sessions the way the daemon does (`claude --worktree <name> --name <name> [-- <prompt>]` in a test repository, hooks off):

- **No first prompt (the cause reproduced).** A session started without a prompt and ended before anyone typed writes no transcript: `~/.claude/projects/` has nothing for it, and `claude -r` in the repository says "No conversations found in this project". Claude Code writes the transcript at the first message, so there is nothing to resume, from the computer or from the app.
- **Another profile (by design).** A session of a profile with its own config folder (`CLAUDE_CONFIG_DIR`, set by the profile's launcher) keeps its transcript in that folder, so plain `claude -r`, which reads `~/.claude`, never lists it; only the profile's alias (`<alias> --resume`) does. Nothing in the app said which command to use.
- **Worktree (does not hide it).** With a first prompt, a worktree session is listed by `claude -r` at the repository root, even after the worktree is kept or removed (`git worktree remove` + branch deleted), and resuming it there works: Claude Code 2.1.318 lists the sessions of the folders inside the repository, and `<repo>/.claude/worktrees/<name>` is one. The daemon's logs show the reporter's app-started sessions were worktree sessions of the default profile, which this version lists. A picker run in another folder (another checkout of the same project) lists only that folder's sessions.

## What Changes

- Session details shows **Resume on the computer**: the command that reopens the session in a terminal on the computer, `cd <folder> && <alias> <resume arguments>` (the folder quoted when needed, the alias being the profile's launcher and the arguments the agent's own: `--resume <id>` for Claude Code, Gemini CLI and Qwen Code, `resume <id>` for Codex, `--session <id>` for Kimi CLI), with a Copy action. It does not depend on the picker, so it works for another profile and for any folder.
- The agents' resume arguments move into `@remote-harness/protocol` (one table the daemon's adapters and the app both use), so the command the app shows is the one the daemon runs for **Resume**.
- Docs: Using the app → Starting, resuming and closing sessions explains how to continue an app-started session on the computer: the first prompt must have been sent, use the alias of the session's profile (plain `claude -r` only sees the default profile), from the session's folder or the repository root, or copy the command from Session details.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: "Session details" gains the Resume on the computer row with its Copy action.

## Impact

- Protocol: a pure `resumeArgs(agent, sessionId)` export; no message changes.
- Daemon: the five adapters' `resumeArgs` call it (same arguments as today).
- App: `features/sessions/details.ts` (and its test), the i18n catalogs (pt-BR, en-US, es-ES).
- Docs: `apps/web/content/*/using-the-app.md`.
