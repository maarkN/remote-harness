## Why

Stopping the demo (`pnpm --filter @remote-harness/daemon demo`, Ctrl+C or SIGTERM) removes the folders in its manifest but leaves `<root>/.remote-harness-demo/state.json` behind, with or without `--perf` (#385). The next run then refuses to start because that folder "already exists and is not the demo's", and `--clean` does not remove it. The demo ran the daemon through the `tsx` wrapper, which exits before the daemon under it has finished shutting down. The demo cleaned up as soon as the wrapper exited, and the daemon wrote its `state.json` afterwards.

## What Changes

- Demo script: run the daemon as one process (`node --import tsx src/cli.ts start --dev`), so the demo waits for the daemon itself to exit before it cleans up.
- Demo script: `--clean` also removes the demo's data home (`<root>/.remote-harness-demo`, used only by the demo), even when an older run left it without a manifest; a start refused only because of that folder suggests `demo --clean`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `demo-mode`: cleanup waits for the daemon to exit, and `--clean` removes a leftover data home.

## Impact

- Daemon dev tooling only: `apps/daemon/scripts/demo.mts`.
