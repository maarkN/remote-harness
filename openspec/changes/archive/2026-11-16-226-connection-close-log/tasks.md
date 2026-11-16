## 1. Close code and reason on the link

- [x] 1.1 `Link.onClose` hands its handlers the close code and reason; `ws-server` passes the WebSocket close event's, and "no pong (dead connection)" for a socket its ping/pong terminated; the ping interval becomes the `heartbeatMs` option; verify typecheck
- [x] 1.2 `relay-client`: the CLOSE frame's u16 code reaches the channel's close handlers with a short reason for the relay's codes (4010 idle, 4031 too slow, 1009 too large), the daemon's own `link.close` passes its code and reason, and a relay connection that ends closes its channels with "relay connection lost"; a test with a fake relay (`ws` server speaking the frames) that the CLOSE frame's code and reason reach the link; verify it passes

## 2. The close line

- [x] 2.1 Tests first in `test/connection-log.test.ts` (an in-memory link and a capturing logger): an authenticated connection the device closes (code, reason, `by: device`, `openMs`), one closed mid-handshake (`closedDuring: handshake`), one the daemon closes (`by: daemon` with its code and reason); verify they fail
- [x] 2.2 `acceptSecureConnection` logs `connection closed` once per connection with the connection id, path, device id, code, reason, who closed it and `openMs` or `closedDuring` (an injectable clock for the duration); verify the tests pass
- [x] 2.3 A test in `test/connection-log.test.ts`: a direct client that stops answering pings (`autoPong: false`) after `auth.ok` is terminated by a server with a short `heartbeatMs` and logged with 1006 and "no pong (dead connection)"; verify it passes

## 3. Verification

- [x] 3.1 `turbo run typecheck test` (all packages but the Go relay) and Biome green
- [x] 3.2 With a daemon from source (`startDaemon` in a temporary home, logging to a file) and a client pairing, authenticating and closing, then one dropped mid-handshake, the log file shows the `connection closed` line with the expected fields
