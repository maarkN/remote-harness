## Why

`remote-harness update` hangs forever with no output when it is run from a directory outside the source checkout (#458): `install.sh` probes the local `pnpm` in the caller's directory with the terminal still attached as stdin, and when `pnpm` is the Corepack shim (Node from nvm, for example) Corepack finds no `packageManager` pin there, wants to download the latest pnpm and asks "Do you want to continue?" on a stderr the script hides. Anyone who installed from the site and runs the update from their home directory can hit it.

## What Changes

- The installer never waits on input the user cannot see: the pnpm probe runs inside the source checkout, with stdin closed and Corepack's download prompt disabled, so the pinned version is resolved and no question is asked.
- Corepack's download prompt is disabled for everything `install.sh` runs, so a shim invoked by a later step cannot prompt either.
- `remote-harness update` starts the installer (and the rollback build) with the source checkout as working directory, so the result does not depend on where the command was typed.
- A regression test sources `install.sh` with a fake `pnpm` that waits for stdin and only answers from the checkout.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `guided-installer`: the "Update command" requirement gains the rule that the update must behave the same from any directory and must not wait on hidden prompts.

## Impact

- `install.sh`: `pnpm_cmd()` probe and a global `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`.
- `apps/daemon/src/cli.ts`: `cwd` of the installer spawn in `update` and in the rollback build.
- `apps/daemon/test/daemon-update.test.ts`: regression test with a fake Corepack-like `pnpm`.
- No protocol, app or i18n change.
