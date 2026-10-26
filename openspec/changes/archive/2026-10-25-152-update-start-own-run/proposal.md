## Why

Updating the computer from the app fails right away with "could not start the updater: nothing to update" although an update is available (#389). `RemoteUpdates.begin()` records the new run and then calls `launch()`, which checks the refusal again; that check counts the run just recorded as "already running" and refuses with a generic "nothing to update". The tray's **Update now** and automatic updates go through the same path, so only `remote-harness update` from the CLI still works.

## What Changes

- Daemon: the launch of the detached updater moves out of the updates feature into an `UpdateLauncher` (`features/updates/launcher.ts`) that owns the "this process spawned the updater" flag. Its `refusal()` (checked by `begin()` before a run is recorded) counts a recorded run; its `launch()` (called after the run is recorded) only refuses for what changed since: an updater this process spawned meanwhile, or an offer that went away.
- Daemon: a launch refused after the run was recorded names its reason with the translated refusal texts ("an update is already running", "cannot update: not-installer", "already up to date") and puts the run record back as it was, so no failed run is left; a generic "nothing to update" is never returned for another cause.
- Tests: a daemon test runs the real `begin()` → `launch()` path with the process spawn mocked, for the app, the tray and automatic updates.

## Capabilities

### New Capabilities

### Modified Capabilities

- `desktop-updates`: starting an update is never refused because of the run it just recorded, and a late refusal is specific and records nothing.

## Impact

- Daemon: `features/updates/{index,remote,launcher}.ts`, `test/daemon-update.test.ts`.
- App: none (it already translates the specific refusal texts).
