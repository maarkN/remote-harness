## 1. Daemon

- [x] 1.1 Add `UpdateLauncher` (`features/updates/launcher.ts`): `refusal()` counts a recorded run, `launch()` only refuses for an updater this process spawned or an offer that went away, with the specific refusal; injectable spawn
- [x] 1.2 Use it in `features/updates/index.ts` for the app, the tray's Update now and automatic updates (menu `updating` flag, failed commit, notifications unchanged)
- [x] 1.3 `LaunchResult` carries `refused`; `RemoteUpdates.begin()` answers a late refusal with its reason and puts the run record back

## 2. Tests

- [x] 2.1 Daemon test: the real `begin()` → `UpdateLauncher.launch()` path with `node:child_process` spawn mocked starts the updater (app start and tray/automatic `begin()`), and is not refused by its own run
- [x] 2.2 Daemon test: a late refusal replies with the specific text and leaves the previous run record
- [x] 2.3 Update the existing `RemoteUpdates` tests for the new result shape

## 3. Verify

- [x] 3.1 `turbo run typecheck test` and Biome green
