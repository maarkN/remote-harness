## Context

Change 175 (Gemini CLI) added `AgentAdapter.approvalDialog`, the `PermissionDialog` hook event and `PermissionBroker.openDialog`: a request that waits for the phone without a hook and is answered by typing into the agent's dialog. Gemini announces its dialog with a hook; Kimi does not announce it at all.

Facts about Kimi CLI 1.52.0 used here (read from the wheel, not run):
- Data dir: `KIMI_SHARE_DIR` or `~/.kimi` (`config.toml`, `kimi.json`, `credentials/`, `sessions/`). `kimi.json` has `{work_dirs: [{path, kaos, last_session_id}]}`.
- Sessions: `sessions/<md5(work dir)>/<session id>/` with `wire.jsonl` (append-only; first line `{"type":"metadata","protocol_version":…}`, then `{timestamp, message: {type, payload}}`), `context.jsonl` (rewritten by `/clear`, `/undo` and compaction: not followed) and `state.json` (`custom_title`, `plan_mode`, `approval`). Streamed parts are merged before they are written. Types: `TurnBegin {user_input}` (string or parts), `SteerInput {user_input}`, `ContentPart` (`text` / `think`), `ToolCall {id, function: {name, arguments}}`, `ToolResult {tool_call_id, return_value: {is_error, output, message}}`, `StepInterrupted`, `CompactionBegin` / `CompactionEnd`, `TurnEnd`, `StatusUpdate`, and others.
- Hooks: `[[hooks]]` tables in `config.toml` (`event`, `command`, `matcher`, `timeout` in seconds), run with `/bin/sh` and Kimi's environment; stdin `{hook_event_name, session_id, cwd}` plus `prompt` (`UserPromptSubmit`), `source` (`SessionStart`). No transcript path. `Stop` fires when a turn ends normally, `StopFailure` when it fails, neither on Esc. Kimi rewrites `config.toml` with tomlkit when it saves settings (comments are lost).
- Approval panel: a yellow box titled `approval`, "`<tool>` is requesting approval to `<action>`:", a preview, then `[1] Approve once`, `[2] Approve for this session`, `[3] Reject`, `[4] Reject, tell the model what to do instead`. Digits choose at once; Esc rejects.
- TUI (prompt_toolkit): Enter submits, Ctrl-J adds a line, Esc cancels a running turn. `--session <id>` resumes (an unknown id starts a new session with it).

## Goals / Non-Goals

**Goals:** Kimi sessions in the list (live and recent), their conversation, prompts and keys, start and resume from the phone, approvals from the phone, push and live status; other agents unchanged.

**Non-Goals:** plan mode or yolo from the app, session names (`/title`), status line and token usage, the one-shot call, subagent events, questions (`AskUserQuestion` panels stay in the terminal), skills in the command list.

## Decisions

- **Adapter.** `kimi.ts`: `configDirEnv: 'KIMI_SHARE_DIR'`, default `~/.kimi`, `resumeArgs: ['--session', id]`, `hooks.style: 'kimi-toml'` on `config.toml`, `approvalDialog` with `detect: 'screen'`, new optional `transcriptPath(configDir, sessionId, cwd)` → `sessions/<md5(cwd)>/<id>/wire.jsonl`.
- **Transcript path from the hook.** `HookReceiver` fills a missing `transcript_path` from the profile's adapter before emitting the hook, so the registry, the transcript feature and the profile match work unchanged.
- **Discovery.** `findTranscripts` lists `sessions/*/*/wire.jsonl` modified since the cutoff (the session id is the folder name). `readSummary` takes the title from `state.json` (`custom_title`), else the first `TurnBegin`; the folder from the `kimi.json` work dir whose md5 is the parent folder's name.
- **Format.** Lines are appended once (no `upserts`); keys are `line-<cursor>:<index>`. `TurnBegin` / `SteerInput` → `user` (text parts and `image_url` data URLs); `ContentPart` `text` → `assistant_text`, `think` → `thinking`; `ToolCall` → `tool_use` with mapped names; `ToolResult` → `tool_result` (`output` text, else `message`; `is_error`); `StepInterrupted` → `turn_aborted`; `CompactionEnd` → `compact_boundary`. Tool mapping: `Shell {command}` → `exec`, `ReadFile {path}` → `Read {file_path}`, `WriteFile {path, content}` → `Write {file_path, content}`, `StrReplaceFile {path, edit}` → `Edit {file_path, old_string, new_string}` (first edit), `Grep {pattern, path}` → `Grep`, `Glob {pattern, directory}` → `Glob {pattern, path}`, `SearchWeb {query}` → `WebSearch`, `FetchURL {url}` → `WebFetch`.
- **TOML hooks without a TOML writer.** `kimi-hooks.ts` splits the file at top-level table headers; a `[[hooks]]` table whose `command` (a basic or literal string) matches the daemon's `curl` URL is ours. Merge removes ours and appends one table per event at the end (basic strings, escaped); remove drops ours only. Every other line stays byte for byte. A root `hooks = …` key makes the file unmergeable: install skips it with a line in its report and doctor fails the check.
- **Screen watcher.** `ApprovalDialog` gains `detect: 'hook' | 'screen'` and `identify(screen)` (the panel text from the request line to `[1]`). In the permissions feature, a one-second timer captures the pane of each controllable `running` or `waiting` session whose agent's dialog is `screen`-detected. A panel with no open request for the session: emit a `PermissionDialog` hook on the bus (state `waiting`), read the tail of the session file for the newest `tool_use` without a `tool_result` (else the panel's tool name) and `openDialog`. The request remembers the panel's identity; typing checks `isOpen` and the same identity. No panel any more, or a different one: the open request resolves as answered in the terminal (`moved`), and a different panel opens a new one. `openDialog` on a session that already has an open dialog request resolves the old one first (also for Gemini).
- **Keys.** Allow `1`, Deny `3` (Escape also rejects, but `3` cannot cancel a turn if the panel just closed).
- **Setup and doctor.** `detectConfigDirs` adds `~/.kimi` when it holds `config.toml`, `kimi.json` or `sessions`; `suggestProfile` gives it `agent: 'kimi'`, id `km` (`kimi` is a reserved alias), name `Kimi`, the Kimi color. Doctor checks `kimi` on the PATH and the hooks.

## Risks / Trade-offs

- [Nothing was run against a live Kimi CLI] → fixture tests from the 1.52.0 types; the PR lists what is unverified (hooks running, panel text in tmux, ToolCall flushed before the panel).
- [Polling panes costs a `capture-pane` per running Kimi session per second] → only `running`/`waiting` Kimi sessions with a pane, and nothing for other agents.
- [A panel replaced by an identical one between two polls looks the same] → the answer then goes to an identical request (same tool, same preview).
- [Esc fires no `Stop`, so a cancelled turn stays `running` until the next hook] → accepted for now; the watcher keeps working.
