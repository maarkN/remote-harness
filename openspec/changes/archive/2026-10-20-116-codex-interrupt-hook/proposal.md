## Why

Issue #291: whenever a Codex session pauses for any reason without finishing its turn outright —
most commonly Codex stopping mid-task to ask the user a clarifying question — replying from the
app's chat does nothing; only typing the reply directly into the tmux pane on the computer works.

Investigation traced this to the daemon's Codex hook wiring, not to the tmux paste mechanics
`session.input` already uses for every agent. Codex's own hook schema (extracted from the
installed `codex` 0.163 binary's embedded JSON Schema, `codex debug` tooling has no CLI to print
it directly but the schema ships inside the binary) defines twelve hook events: `PreToolUse`,
`PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`,
`UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop` and `Interrupt`. The daemon's
`CODEX_HOOK_EVENTS` (`apps/daemon/src/features/hooks/settings-hooks.ts`) only installs five of
them: `SessionStart`, `UserPromptSubmit`, `PermissionRequest`, `Stop`, `SessionEnd`. `Interrupt` —
the event a turn fires when it is paused rather than cleanly finished, which is the exact shape of
"stopping to ask how it should proceed" — is never installed, so the daemon never learns about it.

Without that hook, a session that pauses this way keeps whatever state the last `UserPromptSubmit`
left it in (`running`), because nothing ever moves it back to `idle`. This breaks delivery
end-to-end for the common case:
- The app's default `session.input` mode is `auto`, which treats a `running` (or `waiting`)
  session as busy and queues the prompt instead of pasting it (`features/queue/queue.ts`'s
  `isBusy`).
- The queue only auto-delivers once the session reaches `idle` (`canDeliver`). Since nothing
  moves a wedged-`running` Codex session to `idle` until its *next* real `UserPromptSubmit` — which
  can only come from the very prompt stuck in the queue — the prompt waits forever. It shows as
  "queued" in the app, never as an error, matching the issue's "a reply that looks sent but never
  reaches Codex."
- Typing directly in the tmux pane bypasses this path entirely (it goes straight into Codex's
  stdin, not through `session.input`), which is why that always works.

Live interactive reproduction inside this sandbox (driving a real `codex` TUI session through
tmux to confirm the exact pause screen) was not attempted: starting an autonomous coding-agent
session under an existing `codex` login is outside what this sandbox's tooling allows an agent to
do unsupervised. The binary's own hook schema, cross-checked against the existing, tested
`Stop`/`SessionEnd` wiring and the `88-ended-session-state` and `94-codex-session-start` changes'
precedent for this exact state machine, is the evidence base for this fix.

While investigating, a second, smaller gap in the same area surfaced: `permission-approval`'s
handover-to-the-terminal ending conditions (`apps/daemon/src/features/permissions/handover.ts`)
list `UserPromptSubmit`, `Stop` and `SessionEnd` as the hooks that close a request handed over to
the terminal, but not `Interrupt`. A Codex permission dialog handed over to the terminal right
before the turn gets interrupted would otherwise sit open until its own timeout instead of closing
with the turn, for the same root-cause reason.

## What Changes

- `Interrupt` SHALL be added to the daemon's hook vocabulary as a Codex-only event (Claude Code
  has no equivalent; `SubagentStop` stays the mirror-image Codex-schema entry that is already
  deliberately not installed, since Codex does not fire it from single-session use).
- Codex hook installation (`install`, `setup`, their idempotent re-run) SHALL additionally merge
  an `Interrupt` command hook into `<CODEX_HOME>/hooks.json`, same shape and non-blocking timeout
  as `Stop`.
- The session registry SHALL map a Codex session's `Interrupt` hook to `idle`, exactly like `Stop`:
  the turn is no longer actively running and the session is ready for the next prompt. This is
  additive to `session-registry`'s existing `Event-driven state` requirement, not a change to how
  any other hook or agent behaves.
- A permission request handed over to the terminal SHALL also end on an `Interrupt` hook of its
  session, alongside the existing `UserPromptSubmit` / `Stop` / `SessionEnd`.

## Non-Goals

- Switching Codex's input delivery from tmux paste to the native `codex queue --thread <id>
  --message <text>` CLI subcommand. This exists (confirmed via `codex queue --help`) and looks
  like a more robust long-term delivery path for Codex specifically — it would hand ordering and
  "is the thread ready" entirely to Codex's own app-server instead of tmux/state heuristics — but
  adopting it is a materially larger change to `session-input`'s delivery mechanism that this
  investigation did not get to verify against a live session. Worth its own change once it can be
  tested against a real running session.
- Any other currently-unused Codex hook (`PreToolUse`, `PostToolUse`, `PreCompact`, `PostCompact`,
  `SubagentStart`, `SubagentStop`). Nothing in issue #291 or this investigation shows a gap tied to
  those; adding hooks speculatively is out of scope.
- Reproducing the exact Codex TUI screen shown while paused, or auditing whether bracketed paste
  lands correctly on every such screen. The fix here is state tracking (so `auto` delivery and the
  queue stop stalling), which is what actually breaks the reported path; it does not depend on
  which screen Codex happens to render.
- Live-status / push accuracy for an interrupted Codex session (`features/live-status`). Its own
  hook switch does not react to `Interrupt` either, so a followed session's live status may keep
  showing "working" across an interruption; this is a cosmetic, separate gap from the chat-delivery
  bug this issue reports, and is not touched here.

## Capabilities

### New Capabilities

### Modified Capabilities
- `session-registry`: `Interrupt` (Codex only) is added to the event-driven state mapping, as `idle`.
- `codex-sessions`: hook installation additionally merges `Interrupt`; the hook-to-state mapping
  documents it alongside `Stop`.
- `permission-approval`: a handed-over request also ends on an `Interrupt` hook of its session.

## Impact

`apps/daemon/src/features/hooks/payloads.ts` (new Codex-only event name), `apps/daemon/src/features/hooks/settings-hooks.ts`
(`CODEX_HOOK_EVENTS`), `apps/daemon/src/features/sessions/state.ts` (`hookState`), `apps/daemon/src/features/permissions/handover.ts`
(`MOVING_HOOKS`). No protocol/wire schema change, no app change: this is entirely the daemon
installing and listening for a hook event Codex already supports but was never asked to send.
