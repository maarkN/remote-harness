## Why

Only Claude Code and Codex have adapters (issue #424); Gemini CLI is not even an agent id in the protocol. Gemini CLI 0.66 (read from the `@google/gemini-cli` bundle, October 2026) has what the daemon needs to follow and control a session from tmux: command hooks in `settings.json` with the session id, transcript path and cwd on stdin, an append-only JSONL session file per session, `--resume <uuid>`, a config home that can be moved with `GEMINI_CLI_HOME`, and a `Notification` hook fired right before every tool approval dialog. What it lacks is a hook that can approve a tool: hooks may only deny or force the dialog. So approvals from the phone are answered by pressing the dialog's own keys in the pane.

## What Changes

- **Protocol**: `gemini` joins the agent ids. An unknown agent id on a session or profile now reads as absent (Claude Code) instead of failing the whole message, so the next agent added does not break older apps' session lists.
- **Gemini adapter** in the daemon: `gemini` command, config dir `~/.gemini` (a profile's `configDir` must be a `.gemini` folder; its parent goes in `GEMINI_CLI_HOME`, unset for `~/.gemini`), `--resume <id>`, session files under `tmp/<project>/chats/session-*.jsonl`, title from the first prompt, folder from the project's `.project_root`, built-in slash commands, and input timing (Enter at least 250 ms after a paste, `C-j` for line breaks). No worktree, no session name, no modes switcher, no status line, no providers and no one-shot call in this change.
- **Session file parser** (`features/transcript/gemini-format.ts`, the only code that knows the format): prompts, replies, thoughts, tool calls with their results, info/warning/error lines. Gemini appends a message again with the same id when it gains tool calls or token counts; the transcript reader indexes the first line of each entry key and drops later copies, so every entry shows once. Shell, file and search tools get the names the app already renders (`exec`, `Read`, `Write`, `Edit`, `Grep`, `Glob`, `WebSearch`).
- **Hooks**: `install` / `setup` merge command hooks into the profile's `settings.json` (read → merge → backup → atomic write, idempotent) for `SessionStart`, `BeforeAgent` (posted as `UserPromptSubmit`), `AfterAgent` (as `Stop`), `Notification` (as the new `PermissionDialog`) and `SessionEnd`, with timeouts in milliseconds. Gemini runs no hooks in folders it does not trust; setup, doctor and the docs say so.
- **Approvals through the pane**: a `PermissionDialog` hook opens a permission request on the phone (Allow / Deny, no Always) built from the dialog's details, and returns at once so Gemini shows its dialog. The answer is typed into the pane once the dialog is on screen: `1` ("Allow once") or Escape ("No"). Answered in the terminal, expired or the session moved on: the request is resolved like any other.
- **Setup and doctor**: `~/.gemini` is detected and offered as a Gemini profile (`gem`, "Gemini"); doctor checks `gemini` on the PATH and the Gemini hooks; `gemini` becomes a reserved alias.
- **App**: Gemini agent color, name, code and a placeholder icon; worktree option hidden for Gemini.
- **Web**: Gemini CLI chip in the "Works with" strip as supported, FAQ and docs updated in the three languages.
- Never offered from the app: `--yolo` / `--approval-mode yolo`, nor any mode switch.

## Capabilities

### New Capabilities
- `gemini-sessions`: following and controlling Gemini CLI sessions.

### Modified Capabilities
- `protocol`: `gemini` agent id; unknown agent ids tolerated.
- `daemon-config`: `gemini` accepted as a profile agent.
- `app-shell`: Gemini agent color and icon.
- `product-identity`: Gemini agent color.
- `web-landing`: Gemini CLI listed as supported.

## Impact

`packages/protocol` (agent id), `apps/daemon` (agents, transcript reader and Gemini format, hooks installer and launcher, permissions broker, sessions, setup, doctor, i18n), `apps/mobile` (agent table, icon, worktree toggle), `apps/web` (strip, FAQ, docs, marks). Apps released before this change reject a session list that holds a Gemini session, so the app update must ship with the daemon's. Validated against the 0.66.0 sources only: nothing here was run against a live Gemini CLI.
