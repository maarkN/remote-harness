## 1. Installer

- [x] 1.1 Export `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` near the top of `install.sh`, with a comment naming #458, and verify `bash -n install.sh` passes
- [x] 1.2 Rewrite the probe in `pnpm_cmd()` to run in `$SRC_DIR` with stdin closed and the prompt disabled, keeping the `npx --yes pnpm@<wanted>` fallback, and verify the regression test in 2.1 passes
- [x] 1.3 Check the other steps outside `quiet()` for the same pattern (stdin attached + output hidden) and record the result in design.md → Context

## 2. Regression test

- [x] 2.1 In `apps/daemon/test/daemon-update.test.ts`, source `install.sh` with a fake `pnpm` on `PATH` that reads stdin to the end and answers the pinned version only from the checkout with the prompt disabled; run `pnpm_cmd` from another directory with the stdin pipe kept open and verify `PNPM` resolves to `pnpm` within the timeout
- [x] 2.2 Same harness with a fake that answers a wrong version, and verify `PNPM` falls back to `npx --yes pnpm@<wanted>`

## 3. CLI

- [x] 3.1 Spawn `install.sh --update` and the rollback build with `cwd: source.root` in `apps/daemon/src/cli.ts`, and verify `pnpm --filter @remote-harness/daemon typecheck` passes

## 4. Verification

- [x] 4.1 `pnpm turbo run typecheck test` and Biome on the worktree are green
