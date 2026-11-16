## 1. Client deadline and foreground retry

- [x] 1.1 Tests first in `core/connection/daemon-client.test.ts`: the handshake never answered, the `auth` never answered (no request error), the deadline cleared by `auth.ok`, and `resumeNow()` while authenticating; verify they fail against the current client (the socket stays open in `authenticating`)
- [x] 1.2 `DaemonClient`: `HANDSHAKE_DEADLINE_MS` (10 s, `handshakeTimeoutMs` option) armed when the socket opens and cleared by `auth.ok` or the socket closing; on expiry the attempt is dropped like a dead connection with "handshake timeout"; `resumeNow()` drops an attempt still authenticating and opens a new one at once; verify the tests pass

## 2. Messages that do not validate

- [x] 2.1 Tests first: an `auth.ok` that does not validate ends the attempt (status `unauthorized`, close code 4002, no retry, error naming `auth.ok`), other invalid messages are counted and reported with their type and parse code while the connection stays open; verify they fail
- [x] 2.2 `DaemonClient`: `invalidMessages` and `onInvalidMessage` (type, parse code, message); `handleMessage` reports every message `parseServerMessage` rejects and ends the attempt when it is the reply to the pending `auth`; verify the tests pass
- [x] 2.3 Error log: source `message` in `features/error-reports/scrub.ts`, `bindErrorReports` records invalid messages (type and code, scrubbed text) and warns in the console in development builds; a test that the entry keeps the type and code; verify the error-reports tests pass

## 3. Visible error

- [x] 3.1 The connection store keeps the close code; `ConnectionBanner` shows "incompatible versions: update both" for close code 4002 instead of "pairing rejected — pair again", in pt-BR, en-US and es-ES; verify typecheck and the i18n parity test

## 4. Verification

- [x] 4.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 4.2 On the iOS simulator (Release build, iPhone 17 Pro, against a daemon from source in a temporary home): the app pairs, connects (session list, Settings → Devices) and, sent to the background and brought back, is connected again without a banner
- [ ] 4.3 Pending: on a phone, a connection interrupted mid-handshake (app sent to the background while connecting, or Wi‑Fi turned off right after opening) recovers within about 10 s without relaunching the app
