## Why

Kimi has a name, color and icon in the app and a "soon" chip on the landing, but no daemon adapter (issue #425). Kimi CLI 1.52 (read from the `kimi-cli` wheel, October 2026) has what the daemon needs to follow a session from tmux: Claude-style command hooks in `config.toml` (`SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd`) with the session id and folder on stdin, an append-only `wire.jsonl` per session under a folder named after the md5 of the work dir, `--session <id>` to resume and `KIMI_SHARE_DIR` to move its data. It has no hook for tool approvals at all (`PreToolUse` can only deny, and nothing announces the approval panel), so the daemon watches the pane of a running Kimi session for the panel and answers it with its own keys, the way change 175 answers Gemini CLI's dialog.

## What Changes

- **Kimi adapter** in the daemon: `kimi` command, data dir `~/.kimi` (`KIMI_SHARE_DIR`, unset for `~/.kimi`), `--session <id>`, sessions under `sessions/<md5(work dir)>/<id>/wire.jsonl`, title from `state.json`'s `custom_title` else the first prompt, folder from `kimi.json`'s work dirs, built-in slash commands, Enter at least 100 ms after a paste and `C-j` for line breaks. Hooks carry no transcript path, so the adapter derives it from the data dir, the folder and the session id. No worktree, no name, no modes, no status line, no providers and no one-shot call (`--print` approves everything).
- **Wire parser** (`features/transcript/kimi-format.ts`, the only code that knows the format): prompts (with data-URL images) and mid-turn messages, replies, thinking, tool calls with their results, interruptions and compactions. `Shell`, `ReadFile`, `WriteFile`, `StrReplaceFile`, `Grep`, `Glob`, `SearchWeb` and `FetchURL` get the names the app renders (`exec`, `Read`, `Write`, `Edit`, `Grep`, `Glob`, `WebSearch`, `WebFetch`).
- **Hooks in `config.toml`**: `install` / `setup` add one `[[hooks]]` table per event (`SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure` posted as `Stop`, `SessionEnd`) with the daemon's `curl` command; read → merge → backup → atomic write, idempotent, every other line of the file kept as it is. Kimi rewrites the file itself (dropping comments), so our tables are found by their command, not by markers. A file that declares `hooks` another way (an inline array) is left alone and doctor reports it.
- **Approvals through the pane**: while a Kimi session is running, the daemon checks its pane every second for the approval panel. A panel that appears opens a permission request on the phone (Allow / Deny, no Always) with the tool call the session file shows as still unanswered, and the session shows as waiting. Allow presses `1` ("Approve once"), Deny presses `3` ("Reject"), only while the same panel is still on screen. A panel that goes away without the phone resolves the request as answered in the terminal.
- **Setup and doctor**: `~/.kimi` is detected and offered as a Kimi profile (`km`, "Kimi"); doctor checks `kimi` on the PATH and the hooks; `kimi` becomes a reserved alias.
- **App**: worktree option stays hidden for Kimi (already).
- **Web**: Kimi CLI listed as supported (no "soon"), FAQ and docs updated in the three languages.
- Never offered from the app: `--yolo`, `/yolo`, `/afk` or `--print`.

## Capabilities

### New Capabilities
- `kimi-sessions`: following and controlling Kimi CLI sessions.

### Modified Capabilities
- `web-landing`: Kimi listed as supported.

## Impact

`apps/daemon` (agents, Kimi format, TOML hooks installer, hook receiver transcript path, pane approval watcher, setup, doctor, i18n), `apps/web` (strip, FAQ, docs), README. The protocol and the app already know `kimi`. Validated against the 1.52.0 sources only: nothing here was run against a live Kimi CLI.
