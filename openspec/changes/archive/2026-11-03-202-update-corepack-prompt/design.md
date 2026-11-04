## Context

See proposal.md → Why. `install.sh` already runs its long steps through `quiet()`, which does `cd "$SRC_DIR"` and `</dev/null`; only the probe in `pnpm_cmd()` (`pnpm --version 2>/dev/null`) runs in the caller's directory with the terminal as stdin. Corepack's shim resolves the pnpm version from the current directory and, with `COREPACK_ENABLE_DOWNLOAD_PROMPT=1` (its default) and a TTY on stdin, writes `? Do you want to continue? [Y/n]` to stderr and waits for stdin. The other steps outside `quiet()` do not read stdin: `node -p`, `uname`, `curl -o`, `tar`, and the `git` calls already have `</dev/null`; the wizard and `update --finish` are interactive by design.

## Goals / Non-Goals

- Goal: the probe can never block, and the installer as a whole never inherits a prompt from a Corepack shim.
- Goal: keep using the local pnpm when it matches the pin (no download on every update).
- Non-goal: changing the pinned pnpm version or the `npx --yes pnpm@<version>` fallback.

## Decisions

- **Probe in a subshell inside the checkout, stdin closed, prompt disabled**: `( cd "$SRC_DIR" && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version ) </dev/null 2>/dev/null`. In the checkout the shim resolves the pinned version, so the answer equals `wanted` whenever the shim works, and the fallback stays for a missing or older pnpm. Alternative considered: always use `npx --yes pnpm@<wanted>`; rejected because it downloads pnpm on every run and makes the update slower for everyone to fix a hang that only some hit.
- **`export COREPACK_ENABLE_DOWNLOAD_PROMPT=0` at the top of the script**: belt and braces for any shim a later step may call (`npx`, `pnpm` inside `quiet()`), so the rule "nothing waits on a hidden question" does not depend on each call site remembering it. The variable is harmless for a non-Corepack pnpm and for the wizard.
- **`cwd: source.root` when the CLI spawns `install.sh --update` and the rollback build**: the script uses absolute paths, so this changes nothing today; it makes the spawn independent of the user's directory for any future relative command in the script.
- **Regression test with a fake shim**: a `pnpm` on `PATH` that reads its stdin to the end before answering, and only prints the pinned version when its working directory is the checkout and the prompt is disabled. The test keeps the child's stdin pipe open, so an unfixed probe hangs until the test's timeout, while the fixed one resolves `PNPM=(pnpm)` at once. A second fake answers a wrong version to check the `npx` fallback. Alternative considered: a real TTY through `script`; rejected as flaky across macOS and Linux CI.

## Risks / Trade-offs

- [The test hangs on a regression instead of failing fast] → the child runs with a timeout; a timed-out run fails the assertion.
- [`pnpm --version` without network in the checkout, with the pinned version not cached] → the probe fails, the fallback to `npx` runs inside `quiet()` and fails visibly with the log, as today.
