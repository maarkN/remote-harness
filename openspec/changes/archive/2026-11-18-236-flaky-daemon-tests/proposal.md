## Why

Daemon tests fail now and then on a loaded machine and pass on a rerun (#609), so a green change can come back red. One of them hides a real daemon race; the others are races in the test only.

- **`daemon-update` › "an updater that dies without a record is marked failed"** (macOS CI, run 44015691742): the last `daemon.update.info` broadcast still said `fetching` although the run record on disk said `failed`. The issue blamed the test for reading between the write and the broadcast, but that window does not exist: the broadcast follows the write in the same microtask chain. The real cause is the run poll. While a run is followed, the daemon reads the record every second (every 20 ms in the test). A read that began before the updater died and resolves after `failed` was written applies what it read: the run goes back to `fetching`, it is broadcast, and since polling already stopped nothing corrects it. The daemon then reports an update in progress and refuses "an update is already running" for up to 30 minutes (until the run counts as stale). Reproduced deterministically by holding one poll read until after the updater's exit was handled: the last broadcast is `fetching` and `running()` stays `true`.
- **`permission-rules` › "an allow always is logged with the device; rules are listed, undone and deleted"**: the approval log is written in the background (`rules.delete` answers `ack` without waiting for the log line), and the test reads the log once, right after the `ack`. Reproduced deterministically by delaying the `delete` entry by 100 ms: the test fails with the same message as the flaky run (`expected [ 'undo', 'allow' ] to deeply equal [ 'delete', 'undo', 'allow' ]`). The daemon is right to answer first: the request should not wait on the log, and a failed write is already logged as a warning.
- **`hooks` › "every hook stays silent when the daemon is not running"** (found while running the suite under load for this change: one `turbo run test` in seven failed with an unhandled `write EPIPE` at `child.stdin.end`): in this test the hook's curl config does not exist, so curl exits at once without reading its input. When the test process is descheduled between spawning the hook and writing its input, the hook is already gone and the write fails. Reproduced by blocking the event loop for 300 ms between the spawn and the write: `Unhandled 'error' event` (EPIPE). Installed hooks always have their curl config, so curl reads its input; this is a race in the test only.

## What Changes

- The daemon ignores a run poll read that began before polling stopped (the run finished, or the updater died and its run was marked failed), so a finished run never goes back to an earlier step.
- The `daemon-update` test waits for the broadcast and the record together. A new test holds a poll read across the updater's exit and checks that the run stays `failed`, is broadcast last, and no longer counts as in progress.
- The `permission-rules` test waits for the approval log to hold the three entries instead of reading it once after the `ack`. The daemon keeps writing the log in the background.
- The `hooks` test ignores a write error on the input of a hook that already exited.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`: "Update from the app" — an updater that exits with an error without finishing the record leaves the run `failed` for good; a progress read that began earlier cannot bring an earlier step back.

## Impact

- Daemon: `features/updates/remote.ts` (the poll discards stale reads).
- Tests: `test/daemon-update.test.ts`, `test/permission-rules.test.ts`, `test/hooks.test.ts`.
- No protocol, app or i18n change.
