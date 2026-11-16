## Why

The daemon cannot tell which app build is talking to it: `auth` carries a constant client name (`claude-remote-ios`) and the version only travels the other way (`daemonVersion` in `auth.ok`). When something goes wrong on a phone, "which build?" has no answer on the computer (#591): #589 was diagnosed by validating the daemon's messages against three app releases because the build was unknown, and the daemon has no record of how old each paired phone's app is.

## What Changes

- `auth` gains an optional `app { version, runtime?, update? }`: the app version (`expo-constants`, `1.2.2`), the runtime version that fingerprints the native build, and the OTA update id when an update is running (absent for the embedded bundle). Optional, so older apps keep working; malformed values are dropped instead of refusing the connection, so a bad field can never lock a phone out. The app sends it from every connection it opens (the main one and the direct probe).
- The daemon's `client authenticated` line carries the app version, runtime and update.
- Each paired device keeps the last `app` it authenticated with in `paired-devices.json`; `devices.result` and the CLI's admin route return it, and `remote-harness devices list` prints it ("app 1.2.2", or "app ?" for a phone that never sent it), in the three CLI languages.
- `diagnostics.result` gains `devices`: each paired device's ID, platform, last seen, last app and whether it is the asking one (no names, which the user may have set to a person's name). "Report a problem" puts them in the report's `daemon` block, so a report shows which app the computer last saw from each phone.
- Tests on the protocol schema (with, without and with a malformed `app`), the daemon log line, the device record and its persistence, the CLI row and the diagnostics reply.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `protocol`: "Protocol version" (`auth.app`), "Paths, devices and lean traffic messages" (`devices.result` items carry `app`), "Daemon diagnostics" (`diagnostics.result.devices`).
- `daemon-auth`: "Paired devices" (the last app per device, the log line, the CLI list).
- `error-reports`: "Report a problem" (the devices block from the computer).

## Impact

- Protocol: `client.ts` (`auth.app`), `domain.ts` (`AppBuildSchema`, `PairedDeviceInfo.app`), `server.ts` (`diagnostics.result.devices`).
- Daemon: `transport/secure-connection.ts` (log line, `seen` with the app), `features/pairing/devices.ts` and `index.ts` (record and wire form), `features/diagnostics/index.ts`, `main.ts` (wiring), `cli.ts` and the three CLI catalogs.
- App: `core/connection/daemon-client.ts` (`appBuild` option, sent in `auth` and the probe's `auth`), `core/connection/connection-store.ts` (the running build), `features/error-reports/format.ts` and `ReportProblemScreen.tsx` (devices in the report).
- No new dependency.
