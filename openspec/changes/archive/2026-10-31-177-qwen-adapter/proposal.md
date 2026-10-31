## Why

Qwen has a name, color and icon in the app and a "soon" chip on the landing, but no daemon adapter (issue #426). Qwen Code 0.26 (read from the `@qwen-code/qwen-code` bundle, October 2026) is the closest of the remaining agents to Claude Code: command hooks in `settings.json` with Claude Code's event names and stdin fields (`session_id`, `transcript_path`, `cwd`), a `PermissionRequest` hook that allows or denies with Claude Code's answer shape (empty output falls back to its own dialog), an append-only JSONL transcript per session, `--resume <id>` and `QWEN_HOME` to move its config. So Qwen sessions can be followed and controlled the way Codex sessions are, approvals included, with no screen reading.

## What Changes

- **Qwen adapter** in the daemon: `qwen` command, config dir `~/.qwen` (`QWEN_HOME`, unset for `~/.qwen`), `--resume <id>`, transcripts under `projects/<folder with non-alphanumerics as ->/chats/<id>.jsonl`, title from the latest `custom_title` record else the first prompt, folder from the records' `cwd`, built-in slash commands, Enter at least 250 ms after a paste and `C-j` for line breaks. No worktree, no name, no modes, no status line, no providers and no one-shot call in this change.
- **Transcript parser** (`features/transcript/qwen-format.ts`, the only code that knows the format): prompts typed by the user, replies, thoughts, tool calls with their results, compactions; `custom_title` records update the title. Tool names get the names the app renders, as for Gemini CLI (`exec`, `Read`, `Write`, `Edit`, `Grep`, `Glob`, `WebSearch`, `WebFetch`).
- **Hooks**: `install` / `setup` merge command hooks into the profile's `settings.json` (read → merge → backup → atomic write, idempotent) for `SessionStart`, `UserPromptSubmit`, `PermissionRequest`, `Notification`, `Stop`, `StopFailure` (posted as `Stop`) and `SessionEnd`; the permission hook prints the daemon's answer like Codex's, timeouts in seconds.
- **Approvals**: Allow / Deny from the phone through the `PermissionRequest` hook, never with rules or a mode change (no "Always").
- **Setup and doctor**: `~/.qwen` is detected and offered as a Qwen profile (`qw`, "Qwen Code"); doctor checks `qwen` on the PATH and the hooks; `qwen` becomes a reserved alias.
- **App**: worktree option stays hidden for Qwen (already).
- **Web**: Qwen Code listed as supported (no "soon" left), FAQ and docs updated in the three languages.
- Never offered from the app: `--yolo` / `--approval-mode yolo` or `auto`.

## Capabilities

### New Capabilities
- `qwen-sessions`: following and controlling Qwen Code sessions.

### Modified Capabilities
- `web-landing`: Qwen Code listed as supported.

## Impact

`apps/daemon` (agents, Qwen format, hooks installer, setup, doctor, i18n), `apps/web` (strip, FAQ, docs), README. The protocol and the app already know `qwen`. Validated against the 0.26.4 sources only: nothing here was run against a live Qwen Code.
