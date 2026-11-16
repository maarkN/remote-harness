## Why

On the phone a computer can stay at "authenticating…" for good: no session screen loads and only force-quitting the app brings it back (#589, iOS against daemon 1.2.2). The daemon answered correctly the whole time (a Node client built from the app's own `DaemonClient` paired, reconnected and opened every session), so the phone's client is where the connection gets stuck.

Cause, read in `apps/mobile/src/core/connection/daemon-client.ts` and pinned by Vitest tests that fail against the current code: once the socket opens, `open()` clears the connect timer, sets `authenticating` and sends the first handshake message, and from then on nothing bounds the attempt. A handshake reply that never arrives, or an `auth` request that times out (only `unauthorized` / `protocol_mismatch` are handled), leaves the socket open in `authenticating`; an `auth.ok` that `parseServerMessage` rejects is dropped silently by `handleMessage`, with the same result. The heartbeat only starts after `auth.ok`, and `resumeNow()` returns early for `authenticating`, so coming back to the foreground never retries. The daemon keeps that socket alive with WebSocket pings, so nothing closes it from either side. In the tests, a socket whose handshake or `auth` is never answered is still open in `authenticating` after the deadline, and `resumeNow()` leaves it in place. Assumption (not reproduced on the phone): the handshake reply or the `auth.ok` was lost, for example because the app went to the background mid-connection; the daemon's log of earlier days has `handshake timeout` refusals from the same phone.

## What Changes

- The Noise handshake and the `auth` request share one deadline of 10 s from the socket opening (`HANDSHAKE_DEADLINE_MS`). An attempt still `authenticating` when it passes is dropped like a dead connection (closed without waiting for a close handshake, pending requests failed as disconnected, not reported as a request error) and the client reconnects with the usual backoff, the error reading "handshake timeout".
- `resumeNow()` (the app returning to the foreground, or "Try again") treats a connection still `authenticating` as dead: it drops that attempt and starts a new one at once instead of returning early.
- A server message that fails `parseServerMessage` is no longer dropped silently: the client counts it (`invalidMessages`) and tells `onInvalidMessage` listeners its type and parse code. The app records it in the on-device error log (source `message`, so it travels in "Report a problem") and warns in the console in development builds.
- An `auth.ok` that does not validate ends the attempt with a visible error: the socket is closed, the status becomes `unauthorized` with close code 4002 (as for a protocol mismatch), and the connection banner says the app and the computer run incompatible versions instead of "pairing rejected — pair again". The same banner text now also shows for a real protocol mismatch.
- Tests in `daemon-client.test.ts` for the handshake never answered, the `auth` never answered, an `auth.ok` that does not validate, other invalid messages and `resumeNow()` while authenticating.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-computers`: "Path selection" (the handshake and `auth` deadline, the foreground retry while authenticating, an invalid `auth.ok`).
- `error-reports`: "On-device error log" (server messages that fail validation are recorded).

## Impact

- App: `core/connection/daemon-client.ts` (+ tests), `core/connection/connection-store.ts` (the close code in the store), `ui/ConnectionBanner.tsx`, `features/error-reports/scrub.ts` and `capture.ts` (+ tests), the three catalogs.
- No protocol or daemon change.
