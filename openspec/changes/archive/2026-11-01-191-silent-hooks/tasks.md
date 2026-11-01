## 1. Daemon

- [x] 1.1 `settings-hooks.ts`: one `buildHookEntry` (command hooks for every event; `PermissionRequest` prints the answer with `-m permissionTimeoutSec` and `timeout + 10`; `SessionEnd` 2 s / 3 s; the others 5 s / 10 s), used for `claude-settings`, `codex-hooks` and `qwen-settings`; `buildCodexHookEntry`, `COMMAND_ONLY_EVENTS`, the `http` branch and `secret` in `HookInstallOptions` removed; `isOurHook` still recognizes the old `http` entries
- [x] 1.2 `features/setup/install.ts` stops passing `secret` to `installHooks`; `pnpm --filter @remote-harness/daemon typecheck`

## 2. Tests

- [x] 2.1 `test/hooks.test.ts`: the merge test expects command hooks (permission prints, the others discard); the port-change test reads `command`; new tests: `http` entries of an older install are replaced; every generated hook exits 0 with an empty stdout against a refused connection, `PermissionRequest` included; the `PermissionRequest` command prints the daemon's answer against the real hooks server
- [x] 2.2 `test/codex.test.ts`, `gemini.test.ts`, `qwen.test.ts`, `kimi.test.ts`: `buildHookEntry` instead of `buildCodexHookEntry`, fixtures without `secret` (`pnpm --filter @remote-harness/daemon exec vitest run test/hooks.test.ts test/codex.test.ts test/gemini.test.ts test/qwen.test.ts test/kimi.test.ts test/permission-handover.test.ts`)

## 3. Verify

- [x] 3.1 `pnpm turbo run typecheck test`, Biome (worktree ignore tweak), `openspec validate 191-silent-hooks --strict`
