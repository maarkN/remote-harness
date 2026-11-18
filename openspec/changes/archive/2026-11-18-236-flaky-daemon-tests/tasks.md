## 1. Update run poll

- [x] 1.1 Test first in `test/daemon-update.test.ts`: a run poll read held (through a pass-through mock of the fs helpers) from before the updater exits with code 1 until after its run was marked failed; then the last broadcast is `failed`, `running()` is false and the record says "updater exited (1)". Verify it fails on the current code with the last broadcast at `fetching`
- [x] 1.2 `RemoteUpdates`: a poll read that began before polling stopped is discarded when it resolves; verify the test in 1.1 and the rest of `daemon-update.test.ts` pass
- [x] 1.3 "an updater that dies without a record is marked failed" waits for the record and the broadcast in the same `vi.waitFor`; verify it passes

## 2. Approval log

- [x] 2.1 "an allow always is logged with the device; rules are listed, undone and deleted" waits (`vi.waitFor`) for the approval log to list `delete`, `undo`, `allow` instead of reading it once after the `ack`. Verify it passes with the `delete` entry delayed by 100 ms through a temporary spy (it fails before the change), then without the spy

## 3. Hook input

- [x] 3.1 "every hook stays silent when the daemon is not running" handles an error on the hook's input stream: a hook that exits before reading it is what the test expects. Verify the EPIPE with a stand-alone script (the hook command with a missing curl config, the event loop blocked 300 ms before the write: unhandled `error`; with the handler: ignored), then the test passes

## 4. Verification

- [x] 4.1 20 runs of each of the three files while a full `turbo run test` (all but the Go relay) runs in a loop; all pass, and so does every `turbo run test`
- [x] 4.2 `pnpm check` green (typecheck, tests, Biome with warnings as errors); locally without the Go relay, which has no toolchain on this Mac and runs in CI
