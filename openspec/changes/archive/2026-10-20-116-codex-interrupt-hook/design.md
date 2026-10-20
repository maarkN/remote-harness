## Context

`apps/daemon/src/features/hooks/payloads.ts` defines `HOOK_EVENTS` (and the `HookEventName` type
derived from it) as the event names the daemon's `/hooks/:event` route and `mergeOurHooks` both
understand: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `SubagentStop`,
`Notification`, `PermissionRequest`. `settings-hooks.ts` installs all seven of those into Claude
Code's `settings.json` for the `claude-settings` style, and a separate, smaller
`CODEX_HOOK_EVENTS` list (five of the seven, `Notification` and `SubagentStop` dropped, per the
comment "Codex has no Notification or SubagentStop for us") into Codex's `hooks.json` for the
`codex-hooks` style. `sessions/state.ts`'s `hookState(event, notificationType)` is the single pure
function mapping a hook event to the `SessionState` it produces; `SessionService.handleHook`
(`features/sessions/service.ts`) applies it unconditionally for every event, no per-event-name
branch needed beyond the few side effects already in its `switch`.

Codex's own hook schema (read from the embedded JSON Schema inside the installed `codex` 0.163
binary — `strings` on the binary surfaces `"title": "interrupt.command.input"` and
`"hook_event_name": {"const": "Interrupt", ...}` next to the already-wired events) defines twelve
events, not seven: the daemon's five, plus `PreToolUse`, `PostToolUse`, `PreCompact`,
`PostCompact`, `SubagentStart`, `SubagentStop` and `Interrupt`. `Interrupt`'s input schema
(`cwd`, `hook_event_name`, `model`, `permission_mode`, `session_id`, `transcript_path`, `turn_id`)
is structurally identical to `Stop`'s (which additionally carries `last_assistant_message` and
`stop_hook_active`) — both describe "the turn is no longer actively generating," just for a
different reason (finished vs. paused/interrupted). Neither schema carries a reason code
distinguishing *why* a turn stopped (no enum field on either), which is why `Stop` alone cannot be
blamed for missing the "paused to ask a question" case — by every signal available, `Stop` should
fire identically regardless of how a turn ends. `Interrupt` is the event that is simply never
requested at all.

## Goals / Non-Goals

**Goals:**
- Make the daemon aware of every Codex turn-pausing signal that is not a clean `Stop`, so a
  session's tracked `state` cannot get wedged at `running`/`waiting` indefinitely.
- Keep the change purely additive to the existing hook/state machine: no change to Claude Code's
  behavior, no change to the five Codex hooks already wired, no change to `session.input`'s
  delivery mechanics (tmux paste) for any agent.

**Non-Goals:** see proposal.md's "Non-Goals" (no `codex queue` migration, no speculative wiring of
the other five unused Codex hook events, no live-status fix).

## Decisions

- **`Interrupt` becomes a Codex-only addition to the shared `HookEventName` union, not a merge
  into the existing `HOOK_EVENTS` array.** `HOOK_EVENTS` is reused as-is for Claude Code's
  `settings.json` installer (`style !== 'codex-hooks'` branch in `mergeOurHooks`); folding
  `Interrupt` into it would also install an `Interrupt` hook in every Claude Code profile's
  `settings.json`, for an event Claude Code has no concept of. Instead, `payloads.ts` gets a
  second, documented array (`CODEX_ONLY_HOOK_EVENTS`, mirroring how the existing comment already
  calls out `Notification`/`SubagentStop` as Codex gaps the other way), and `HookEventName` /
  `isHookEventName` become the union of both arrays. `CODEX_HOOK_EVENTS` in `settings-hooks.ts`
  then simply adds `'Interrupt'` to its own list, same as the four other events already there.
- **`hookState('Interrupt')` returns `'idle'`, the same as `'Stop'`**, not `'waiting'`. The two
  candidates differ in how `features/queue/queue.ts` treats the session afterward: `'idle'` makes
  it immediately deliverable (both for a direct `auto`-mode send and for the queue's own
  auto-delivery); `'waiting'` is treated as busy (`isBusy`) and would reproduce the exact stall
  this change fixes, just moved one hook later, since nothing would ever move a `waiting` Codex
  session back to `idle` either. `'waiting'` is reserved for states a *permission decision*
  resolves (`PermissionRequest`/`Notification`), which an `Interrupt` is not — it is resolved by a
  normal free-text prompt, exactly like `Stop`.
- **No new `case` branch in `SessionService.handleHook`'s `switch (hook.event)`.** `Interrupt`
  needs no side effect beyond the generic `patch.state = hookState(...)` already applied before
  the switch; it falls into the existing `default: break`, same as every other hook that carries
  no special handling (e.g. `PreToolUse`, already received-and-ignored today for Claude Code).
- **`Interrupt` is added to `permission-approval`'s handover-ending hook set
  (`handover.ts`'s `MOVING_HOOKS`)**, for the same reason `Stop` is already there: a request handed
  over to the terminal should close when the turn it belonged to is no longer active, and an
  interrupted turn is exactly that, for Codex specifically.
- **`buildCodexHookEntry`'s existing generic branch (non-blocking, `-m 5`/timeout `10`) covers
  `Interrupt` with no new case.** Only `PermissionRequest` (blocks for the daemon's decision) and
  `SessionEnd` (tight 2s/3s budget) get special treatment; `Interrupt`, like `Stop`,
  `SessionStart` and `UserPromptSubmit`, is fire-and-forget.
- **No live reproduction.** Confirming the exact TUI screen Codex shows while paused, and whether
  `codex queue` is a better fit than tmux paste for it, needs a real `codex` session driven
  end-to-end — explicitly out of scope for this sandbox (see proposal.md). This change is
  evidence-based on the binary's own hook schema and the existing, already-tested `Stop`/
  `SessionEnd` → state-machine precedent, not on an interactive repro.

## Risks / Trade-offs

- [Codex might not actually fire `Interrupt` in every "stopped to ask a question" case, e.g. if
  that specific pause is implemented as a plain `Stop` with no special signal at all, and the real
  gap is elsewhere (TUI input handling, not state tracking).] → Mitigation: this fix is strictly
  additive and safe either way — wiring an event the daemon never listened for cannot regress
  anything that works today, and the state-tracking gap it closes (an Codex hook event that exists
  in the schema and was never installed) is real and worth fixing regardless. If #291 turns out to
  have a second cause, the follow-up has one less variable to investigate.
- [Codex's schema lists `Interrupt` but a given installed version might not actually invoke it for
  single-session CLI use the same way the schema implies, similar to how `SubagentStop` is listed
  but deliberately not installed today.] → Mitigation: unlike `SubagentStop` (which has no
  equivalent concept without the subagents feature active), `Interrupt`'s own schema fields
  (`turn_id`, the same `cwd`/`model`/`permission_mode`/`session_id` shape as `Stop`) describe a
  plain single-session turn event with no subagent dependency, so this risk is lower; if wrong,
  installing the hook is still harmless (Codex simply never calls it, same as today).
