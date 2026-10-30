## Context

The daemon asks each session's `AgentAdapter` what the CLI supports. Codex's adapter answered "no" for worktree, name, modes, rules and the one-shot call. Reading the Codex source (0.163–0.165) shows what it now offers:

- `codex --worktree` (boolean): creates a managed worktree under `$CODEX_HOME/worktrees/<bucket>/<repo>` from `HEAD` and starts the thread there. The name is chosen by Codex.
- `/rename <name>`: inline argument, allowed while a turn runs; writes the thread name to `session_index.jsonl`, which the daemon already reads for titles. There is no CLI flag.
- `/permissions <profile-id>` (inline since 0.164): `:read-only`, `:workspace`, `:danger-full-access` or a named profile. The change is recorded right away as an `event_msg` `thread_settings_applied` with `active_permission_profile`; each `turn_context` also carries `sandbox_policy` and, in recent versions, `active_permission_profile`.
- `codex exec --json --ephemeral …`: JSON lines on stdout, the reply in `{"type":"item.completed","item":{"type":"agent_message","text":…}}`; `--ephemeral` writes no rollout; a piped stdin is appended to the prompt as a `<stdin>` block.
- Codex `SessionStart` hooks run with the first turn, not when the TUI opens.

## Goals / Non-Goals

**Goals:** worktree and name at start, permission profile shown and switchable (never full access), honest Always handling, Codex one-shot call for Polish dictation and generated messages.

**Non-Goals:** model providers for Codex profiles; wrapping Codex's status line (its status already comes from the rollout); writing Codex `.rules` files for "always allow".

## Decisions

- **Worktree**: `worktreeArgs` returns `['--worktree']`. The daemon still computes a free name for Claude Code; Codex ignores it. The "not a git checkout" check stays in the daemon.
- **Name**: a new adapter field `renameCommand(name): string | null` (Codex: `/rename <name>`). `LifecycleService.applyName` submits it through the input service when the session registers (once per pane, like the title). Sending it from `start` right after the pane opens would race the TUI and the thread does not exist yet; the registration moment is when Codex has a thread to rename.
- **Permissions**: the Codex format module returns `permissionProfile` next to `approvalPolicy` (from `turn_context` and `thread_settings_applied`), carried through `TranscriptSummary`, the transcript update and the session store to `Session.permissionProfile`. `ModeService.setMode` branches on the adapter: Claude Code keeps the Shift+Tab cycle; Codex validates the preset (`read-only` | `workspace`, `mode_forbidden` for `full-access` / `:danger-full-access` / `bypassPermissions`), refuses while a permission is pending, then submits `/permissions <id>` through the input service (outside the mode lock: the input service takes the same session lock). No optimistic update: the chip only changes when Codex records the change, so it never claims a mode the TUI did not apply (older Codex ignores the inline argument). The adapter keeps `modes` for Claude Code's cycle and gains `presets: { command(preset) } | null` (Codex: `/permissions :read-only|:workspace`).
- **Always**: `PermissionRequestInfo.rules` (`default(true)`), set from the adapter's `permissionRules`. The app hides Always and shows a note for `rules: false`; the daemon already drops rules for such agents.
- **One-shot**: `polish` gains `parse(stdout)`; Claude Code keeps `parseOneShotResult`, Codex reads the last `agent_message` from the JSON lines. The Codex prompt is the instructions, a blank line and the text (`codex exec` has no system-prompt flag). `--ignore-user-config` skips MCP servers and user model settings so the call fits the polish timeout; auth still comes from `CODEX_HOME`. The voice polish passes an empty stdin so neither CLI waits on an open pipe.
- **App**: the Codex chip becomes `CodexPermissionsChip` (in `features/mode`): label from a pure `codexProfileLabel` helper (tested), picker with two presets. `canStartInWorktree` returns true for Codex.

## Risks / Trade-offs

- `/rename` and `/permissions` are typed into the TUI: if the user is typing in the terminal at that moment, the text mixes with theirs. Same trade-off as sending prompts from the app; mitigated by doing it only on registration / explicit taps.
- Codex older than 0.164 ignores `/permissions <id>` (it may open the menu instead). The chip keeps the real profile, and the user can close the menu with Esc from the app's key bar.
- `--ignore-user-config` means a user whose Codex account needs a custom provider in `config.toml` gets no polish (silent fallback).
