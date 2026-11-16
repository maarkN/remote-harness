## 1. Protocol

- [x] 1.1 Tests first in `packages/protocol/test/protocol.test.ts`: `auth` with `app`, without it and with a malformed one (accepted without `app`); `devices.result` items with and without `app`; `diagnostics.result` with and without `devices`; verify they fail
- [x] 1.2 `AppBuildSchema` (`version` ≤ 32, `runtime` and `update` ≤ 64, both optional) in `domain.ts`; `auth.app` (optional, dropped when malformed); `PairedDeviceInfo.app` and `diagnostics.result.devices` (optional for older daemons); verify the tests pass

## 2. Daemon

- [x] 2.1 Tests first: `PairedDevices.touch` keeps the app build (and keeps the previous one when `auth` has none), it survives a reload, and `deviceInfoOf` returns it; `client authenticated` carries `app` (capturing logger); `diagnostics.errors` returns the devices without names, the asking one marked; verify they fail
- [x] 2.2 `seen(deviceKey, app)` from `secure-connection.ts` with the log line, `PairedDevices` keeps `app`, the wire form and the admin route return it; `registerDiagnosticsFeature` reads the devices from `DaemonContext.diagnosticsDevices`, wired in `main.ts`; verify the tests pass
- [x] 2.3 `remote-harness devices list` prints "app <version>" (or "app ?") in pt-BR, en-US and es-ES; verify the CLI i18n parity test and a run of `devices list` against a `paired-devices.json` with and without `app`

## 3. App

- [x] 3.1 `DaemonClient` option `appBuild`, sent as `app` in `auth` and in the direct probe's `auth`; a test that both carry it and that it is absent when not set; verify it passes
- [x] 3.2 `ConnectionProvider` hands the store (`setAppBuild`) the running build (`Constants.expoConfig.version`, `Updates.runtimeVersion`, the update id when not embedded) through a pure `appBuildOf` with a test (empty values dropped, cut to the limits); verify typecheck and the test
- [x] 3.3 "Report a problem": the `daemon` block of the report carries `devices` when the computer sends them; a test in `error-reports.test.ts`; verify it passes

## 4. Verification

- [x] 4.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 4.2 With a daemon from source in a temporary home: a client authenticating with `app` shows it in the log line, in `paired-devices.json` and in `devices list`
- [ ] 4.3 Pending: a phone build with this change connecting to the computer's daemon shows its version in `remote-harness devices list`
