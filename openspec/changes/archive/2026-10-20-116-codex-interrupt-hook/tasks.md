## 1. Hook vocabulary

- [x] 1.1 In `apps/daemon/src/features/hooks/payloads.ts`, add a `CODEX_ONLY_HOOK_EVENTS = ['Interrupt'] as const` with a comment explaining it is the mirror image of the existing `Notification`/`SubagentStop` Codex gap, and widen `HookEventName` to `(typeof HOOK_EVENTS)[number] | (typeof CODEX_ONLY_HOOK_EVENTS)[number]`. Update `isHookEventName` to check both arrays. `HOOK_EVENTS` itself (and therefore Claude Code's installed hooks) stays unchanged.
- [x] 1.2 In `apps/daemon/src/features/hooks/settings-hooks.ts`, add `'Interrupt'` to `CODEX_HOOK_EVENTS`, updating its comment to mention it.

## 2. State mapping

- [x] 2.1 In `apps/daemon/src/features/sessions/state.ts`'s `hookState`, add `case 'Interrupt':` alongside `case 'Stop':` (both return `'idle'`), with a short comment on why (Codex: a turn paused instead of finishing cleanly, same readiness as `Stop`).
- [x] 2.2 In `apps/daemon/test/session-state.test.ts`, add `expect(hookState('Interrupt')).toBe('idle')` to the existing `hookState maps hooks to states` test.
- [x] 2.3 In `apps/daemon/test/codex.test.ts`'s `codex sessions` describe block, add a dedicated test: `SessionStart` → `UserPromptSubmit` (state `running`) → `Interrupt` (no `Stop` in between) asserting `state` becomes `idle` and the session stays controllable, covering the actual regression (a `running` Codex session becoming deliverable again without a `Stop`).

## 3. Permission handover

- [x] 3.1 In `apps/daemon/src/features/permissions/handover.ts`, add `'Interrupt'` to `MOVING_HOOKS`.
- [x] 3.2 In `apps/daemon/test/permission-handover.test.ts`, add `expect(hookMovesOn('Interrupt')).toBe(true)` next to the existing `hookMovesOn` assertions.

## 4. Hook installation coverage

- [x] 4.1 Confirm (no code change expected) that `apps/daemon/test/codex.test.ts`'s `one command hook per Codex event...` test still passes once `Interrupt` is added to `CODEX_HOOK_EVENTS` — it already asserts installed keys equal `CODEX_HOOK_EVENTS` and that every entry `isOurHook`, so the new event is covered without editing the test.
- [x] 4.2 Confirm `buildCodexHookEntry('Interrupt', ...)` falls into the existing generic (non-blocking, 5s/10s) branch with no new test needed beyond 4.1, since only `PermissionRequest` and `SessionEnd` have dedicated assertions today and neither applies to `Interrupt`.

## 5. Spec sync

- [x] 5.1 `session-registry`, `codex-sessions` and `permission-approval` delta specs written under this change (done as part of drafting this proposal).

## 6. Validation

- [x] 6.1 `pnpm --filter @remote-harness/daemon typecheck` and `pnpm --filter @remote-harness/daemon test` (621 tests green); full `npx turbo run typecheck test` across the monorepo also green (11/11 tasks).
- [x] 6.2 `npx biome check --error-on-warnings apps/daemon openspec` (190 files, clean). The worktree-path Biome quirk means the root `pnpm check`'s own Biome step is not representative from inside this checkout; see the project's build-environment notes.
- [ ] 6.3 Manual check on a real Codex session (pause it with a clarifying-question prompt, reply from the app) — **not run**: reproducing this interactively was judged outside what this sandbox's tooling allows an agent to drive unsupervised (see proposal.md); record as a pre-release manual step for whoever merges this.
