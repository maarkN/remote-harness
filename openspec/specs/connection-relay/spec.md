# connection-relay Specification

## Purpose
The connection relay forwards end-to-end encrypted traffic between a daemon and its devices when they cannot reach each other directly, without ever being able to read it, and is hosted by the project in two regions or self-hosted by anyone.

## Requirements

### Requirement: Relay endpoints
The connection relay SHALL be a single HTTP server (`apps/relay`, Go) answering `GET /healthz` with `200` and `{"status":"ok"}` (and `503` once it is shutting down), the daemon endpoint `GET /v1/daemon` and the device endpoint `GET /v1/device/<daemon ID>`, both upgraded to WebSocket with compression disabled and only binary messages accepted. A daemon ID that is not 32 lowercase hex characters MUST be answered with `400` before the upgrade.

#### Scenario: Health check
- **WHEN** a monitor requests `/healthz`
- **THEN** it gets `200` with `{"status":"ok"}`

#### Scenario: Malformed daemon ID
- **WHEN** a client opens `/v1/device/not-an-id`
- **THEN** the relay answers `400` and no WebSocket is opened

#### Scenario: Text message
- **WHEN** a connected device or daemon sends a text WebSocket message
- **THEN** the relay closes that connection with code 4000

### Requirement: Room ownership challenge
A daemon SHALL own the room named by its daemon ID: the first 16 bytes of the SHA-256 of its Ed25519 relay public key, as lowercase hex. On `/v1/daemon` the relay MUST send a challenge `[0x01][32 random bytes]` and accept only an answer `[0x02][32-byte public key][64-byte signature]` whose Ed25519 signature over the ASCII context `remote-harness relay v1` followed by a zero byte and the 32 challenge bytes verifies with that key, received within the handshake deadline; then it SHALL answer `[0x03][16-byte daemon ID]` and open the room. A bad answer MUST close the connection with 4001 and a late one with 4008. A new authenticated connection for a room that already has a daemon SHALL replace it: the old daemon connection is closed with 4009 and its devices with 4004. Nothing else may open or join a room as its daemon.

#### Scenario: Correct signature
- **WHEN** a daemon signs the challenge with its relay key within the deadline
- **THEN** it receives `0x03` with its daemon ID and devices can join its room

#### Scenario: Another key
- **WHEN** a client answers with a valid signature from a different key
- **THEN** it gets the room of that other key's daemon ID, never an existing room of another daemon

#### Scenario: Forged signature
- **WHEN** a client answers with a public key it does not hold the private key for
- **THEN** the relay closes the connection with 4001 and no room is opened or changed

#### Scenario: Silent client
- **WHEN** a client opens `/v1/daemon` and does not answer the challenge within the deadline
- **THEN** the relay closes the connection with 4008

#### Scenario: Daemon reconnects
- **WHEN** a daemon whose old connection is still open authenticates again
- **THEN** the new connection owns the room, the old one is closed with 4009 and the old devices with 4004

### Requirement: Opaque forwarding
Device connections SHALL carry raw binary messages. The daemon connection SHALL carry frames `[type][u32 big-endian channel][rest]`: `0x10 OPEN` (relay → daemon, a device joined on that channel), `0x11 DATA` (both directions, the rest is one device message, forwarded byte for byte), `0x12 CLOSE` (both directions, the rest is a u16 big-endian close code). Each device that joins gets a new channel number in its room. A device message MUST reach the daemon as one DATA frame on its channel, in order, and a DATA frame from the daemon MUST reach that channel's device as one message, in order. A daemon CLOSE SHALL close that device with the given code when it is in 4100–4199 and with 4003 otherwise; a device that goes away SHALL be reported to the daemon as CLOSE with the reason code. A device joining a room with no daemon, or whose daemon leaves, MUST be closed with 4004. An unknown frame type or a frame shorter than its header MUST close the daemon connection with 4000. The relay MUST NOT parse, transform, store or log payloads.

#### Scenario: Round trip
- **WHEN** a device sends a binary message and the daemon answers with DATA on the same channel
- **THEN** the daemon receives OPEN then DATA with the exact bytes, and the device receives the exact bytes of the answer

#### Scenario: Two devices
- **WHEN** two devices are in the same room
- **THEN** each has its own channel and never receives the other's messages

#### Scenario: Daemon drops a device
- **WHEN** the daemon sends CLOSE with code 4101 for a channel
- **THEN** that device's connection is closed with 4101 and the others stay open

#### Scenario: No daemon
- **WHEN** a device opens the room of a daemon that is not connected
- **THEN** the relay closes it with 4004 so the device can try another relay

### Requirement: Relay limits
The relay SHALL enforce, with defaults overridable by environment variables and looked up per daemon ID so they can later differ per daemon: at most 10 concurrent devices per room (the next one closed with 4030); a connection rate and a concurrent connection count per client IP (over them the upgrade is answered `429`); the daemon's challenge deadline (10 s); a bandwidth limit per room as a token bucket shared by both directions and by that daemon ID's reconnections, which slows forwarding instead of dropping frames; a maximum message of 8 MB (a larger one closes the sender with 1009); an outbound buffer per device (a device that cannot keep up is closed with 4031); an idle timeout for device channels with no message in either direction (closed with 4010); and a liveness ping on every connection, closing one that does not answer in time. The client IP SHALL be the TCP peer address unless a header to read it from is configured (the proxy's `X-Real-Ip`, or `Fly-Client-IP`).

#### Scenario: Eleventh device
- **WHEN** a device joins a room that already has 10 devices
- **THEN** it is closed with 4030 and the other 10 are unaffected

#### Scenario: Connection flood
- **WHEN** one IP opens connections faster than the configured rate
- **THEN** the excess upgrades are answered `429`

#### Scenario: Oversize frame
- **WHEN** a device sends a 9 MB message
- **THEN** its connection is closed with 1009 and nothing reaches the daemon

#### Scenario: Bandwidth limit
- **WHEN** a room sends more than its burst
- **THEN** further messages are delayed to the configured rate, all of them still delivered in order

#### Scenario: Idle device
- **WHEN** no message crosses a device's channel for the idle timeout
- **THEN** that device is closed with 4010 and the daemon receives CLOSE for its channel

### Requirement: Relay privacy
The relay MUST NOT log payloads or client IPs. Client IPs SHALL live only in memory, in the per-IP limiter, and an entry SHALL be dropped once it holds no open connection and its rate bucket is full again. Logs SHALL be JSON lines with events (room opened or closed, authentication failures, limits hit, start and stop) identified by at most the first 8 characters of the daemon ID.

#### Scenario: Forwarded traffic
- **WHEN** messages pass through a room
- **THEN** the logs contain no payload bytes, sizes per message or IP addresses

### Requirement: Graceful shutdown
On SIGTERM or SIGINT the relay SHALL stop accepting connections, answer `/healthz` with `503`, close every daemon and device connection with code 1012 (service restart) so both sides reconnect, wait for them up to a configurable timeout and exit.

#### Scenario: Restart during use
- **WHEN** the relay is stopped while a daemon and a device are connected
- **THEN** both receive close code 1012 and the process exits

### Requirement: Relay deploys
`apps/relay` SHALL build a Docker image with a static binary running as a non-root user. `apps/relay/deploy/compose.yml` SHALL run it behind the US server's Traefik (external `web` network, `websecure` entry point, `le` certificate resolver) for `Host(\`us.relay.remoteharness.app\`)`, reading the client IP from `X-Real-Ip`, and `make deploy-relay` SHALL copy the sources and the deploy files to `REMOTE_HARNESS_WEB_SSH` (folder `REMOTE_HARNESS_RELAY_DIR`, default `/srv/remote-harness-relay`), rebuild and restart the container and fail unless it reports healthy. `apps/relay/fly.toml` SHALL run the same image in Fly.io region `gru` for `br.relay.remoteharness.app` with at least one machine always running, reading the client IP from `Fly-Client-IP`, deployed with `make deploy-relay-br`. The repository MUST NOT contain the server's address.

#### Scenario: Deploy the US relay
- **WHEN** the owner runs `make deploy-relay` with `REMOTE_HARNESS_WEB_SSH` set
- **THEN** `https://us.relay.remoteharness.app/healthz` answers `200` behind Traefik

#### Scenario: Missing host
- **WHEN** `REMOTE_HARNESS_WEB_SSH` is not set
- **THEN** `make deploy-relay` stops before copying anything, naming the variable

### Requirement: Relay checks in the monorepo
`apps/relay` SHALL be a workspace package whose `typecheck` runs `go vet ./...` and whose `test` runs `go test ./...`, so `pnpm check` and CI cover it; CI SHALL install Go from the module's `go.mod`.

#### Scenario: Broken relay test
- **WHEN** a relay test fails
- **THEN** `pnpm check` fails
