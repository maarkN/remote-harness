## Context

Codex (change 80) set the pattern for an agent whose hooks look like Claude Code's: command hooks posting to the daemon, a `PermissionRequest` hook held open by the broker and answered with a bare decision. Gemini CLI (175) added a transcript format with tool names mapped to the ones the app renders.

Facts about Qwen Code 0.26.4 used here (read from the npm bundle, not run):
- Config dir: `QWEN_HOME` or `~/.qwen` (`settings.json`, `installation_id`, `oauth_creds.json`, `projects/`). `QWEN_RUNTIME_DIR` can move `projects/` elsewhere; it is not supported here.
- Transcripts: `<config>/projects/<cwd with every non-alphanumeric as ->/chats/<session id>.jsonl`, append-only, created at the first record. Records: `{uuid, parentUuid, sessionId, timestamp, type, cwd, …}` with `type` `user` (`message.parts[{text}]`, `provenance` `real_user` for typed prompts), `assistant` (`model`, `message.parts` with `{text}`, `{text, thought: true}` and `{functionCall: {id, name, args}}`), `tool_result` (`message.parts[{functionResponse: {id, name, response: {output | error}}}]`, `toolCallResult {callId, status, resultDisplay}`) and `system` (`subtype` `custom_title {customTitle}`, `chat_compression`, `session_approval_mode`, …).
- Hooks: `settings.json` `hooks` in Claude Code's shape, `type` `command` or `http`, timeout in seconds; events with Claude Code's names (`SessionStart`, `UserPromptSubmit`, `PermissionRequest`, `Notification`, `Stop`, `StopFailure`, `SessionEnd`, …); stdin `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `permission_mode`, plus `prompt`, `tool_name`, `tool_input`, `notification_type` (`permission_prompt`, `idle_prompt`, `auth_success`). Commands inherit Qwen's environment (`TMUX_PANE` included). `PermissionRequest` is awaited before the dialog; `{hookSpecificOutput: {decision: {behavior}}}` allows or denies, empty output shows the dialog.
- TUI (Ink): Enter submits outside a paste; Ctrl+J adds a line; Esc cancels a running turn. `--resume <id>` resumes.

## Goals / Non-Goals

**Goals:** Qwen sessions in the list (live and recent), their conversation, prompts and keys, start and resume from the phone, approvals from the phone, push and live status; other agents unchanged.

**Non-Goals:** approval mode switching (`auto` and `yolo` are never offered), "Always" rules (`updatedPermissions` is not verified), worktrees and names at start, status line and token usage, the one-shot call, `QWEN_RUNTIME_DIR`, http hooks.

## Decisions

- **Adapter.** `qwen.ts`: `configDirEnv: 'QWEN_HOME'`, default `~/.qwen`, `resumeArgs: ['--resume', id]`, `hooks.style: 'qwen-settings'` on `settings.json`, `permissionRules: false`, `approvalDialog: null`.
- **Discovery.** `findTranscripts` lists `projects/*/chats/<uuid>.jsonl` modified since the cutoff (the id is the file name). `readSummary` reads the head for the folder (`cwd` of the first record) and the first typed prompt, and the tail for the latest `custom_title`.
- **Format.** Records are appended once; keys are `<uuid>:<index>`. `user` with `provenance` `real_user` (or none) → `user`; others are injected context and skipped. `assistant` parts: `thought` → `thinking`, text → `assistant_text`, `functionCall` → `tool_use`. `tool_result` `functionResponse` → `tool_result` (`output`, else `error`, else `resultDisplay`; error when the response has `error` or the status is `error`/`cancelled`). `system` `chat_compression` → `compact_boundary`; `custom_title` → meta `customTitle`. Tool names share `geminiTool` (Qwen forked Gemini CLI's tools), with `edit` as another name for `replace`.
- **Hooks.** Style `qwen-settings`: the Codex command entries (the permission hook prints the daemon's answer, the others discard it, `SessionEnd` within 3 s) for `SessionStart`, `UserPromptSubmit`, `PermissionRequest`, `Notification`, `Stop`, `StopFailure` (posted as `Stop`) and `SessionEnd`.
- **Permissions.** The broker already sends Codex-style bare decisions for agents without `permissionRules`; Qwen gets the same.
- **Setup and doctor.** `detectConfigDirs` adds `~/.qwen` when it holds `settings.json`, `installation_id`, `oauth_creds.json` or `projects`; `suggestProfile` gives it `agent: 'qwen'`, id `qw`, name `Qwen Code`, the Qwen color. Doctor checks `qwen` on the PATH and the hooks.

## Risks / Trade-offs

- [Nothing was run against a live Qwen Code] → fixture tests from the 0.26.4 record types; the PR lists what is unverified (hook delivery, the permission answer, paste timing).
- [Qwen may relaunch itself under Bun, changing the pane's process tree] → the daemon follows panes, not processes.
- [The transcript file appears only at the first record] → `SessionStart` links the pane; the title and conversation follow with the first prompt.
