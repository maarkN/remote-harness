## Why

The daemon logs `client authenticated` when a phone connects and nothing when it leaves, so its log cannot tell a phone that stayed connected for an hour from one that dropped a second after authenticating (#590). The diagnosis of #589 stalled on exactly that blank: three `client authenticated` lines in 25 minutes, no refusal, and no way to know whether those connections lasted or why they ended. Refusals (`connection refused`) and rejected requests (`request rejected`) are already logged; the ordinary close is the missing half.

## What Changes

- One `info` line, `connection closed`, per device connection on either path, with the connection id and path the connection's other lines already carry, the device id once known, the close code and reason, who closed it (`daemon` or `device`), and either how long it stayed open after `auth.ok` (`openMs`) or, when it never got there, the stage it ended in (`closedDuring`: `handshake` or `auth`).
- The link a connection runs on reports its close code and reason: the direct path from the WebSocket close event; the relay path from the connection relay's CLOSE frame, which already carries the device's (or the relay's) close code and was ignored until now, with a short reason for the relay's own codes (idle, too slow, message too large); a relay connection that ends closes its channels with "relay connection lost".
- A direct connection the server-side ping/pong declares dead (no pong since the previous ping) is logged the same way, closed by the daemon with code 1006 and reason "no pong (dead connection)". The ping interval becomes an option of `startWsServer` so tests can shorten it.
- Tests: an authenticated connection the device closes, a connection closed mid-handshake, one the daemon closes, a dead connection on the direct path, and the relay's CLOSE frame code reaching the link.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `daemon-auth`: new requirement "Connection log".

## Impact

- Daemon: `transport/secure-connection.ts` (the close line, `Link.onClose` with code and reason), `transport/ws-server.ts` (close code and reason, the dead-connection reason, `heartbeatMs`), `transport/relay-client.ts` (the CLOSE frame's code), tests in `test/transport.test.ts` and a new `test/connection-log.test.ts`.
- No protocol or app change.
