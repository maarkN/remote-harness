## Context

The relay replaces Tailscale's reachability (ADR-0001) and is the only Go code in the monorepo (ADR-0003). It must stay dumb: everything it forwards is already Noise ciphertext (#364), so it authenticates nothing but room ownership. The daemon (#365) keeps one long-lived connection to its home relay; each device opens its own connection to the same relay.

## Goals / Non-Goals

**Goals:** opaque forwarding, room ownership nobody else can take, abuse limits per daemon ID and per IP, no payload or IP logs, trivial self-hosting (one image, env config).

**Non-Goals:** relay-to-relay federation (devices find the daemon by trying the known relays), persistence (a restart drops every connection and both sides reconnect), accounts or subscriptions (only the per-daemon-ID lookup they will need).

## Decisions

- **Ed25519 relay key, separate from the Noise static key.** The room challenge needs a signature; X25519 cannot sign, and converting keys between curves is not available in Node `crypto`. The daemon keeps two key pairs; the daemon ID is the first 16 bytes of SHA-256 of the Ed25519 public key (128 bits, 32 hex characters in the pairing code). Devices authenticate the daemon through Noise with the X25519 key from the pairing code; the daemon ID only routes. The signed message has a context prefix (`remote-harness relay v1\0`) so the signature cannot be replayed for another purpose.
- **One multiplexed daemon connection, one connection per device.** Devices speak raw binary messages, so the app needs no relay framing. The daemon connection adds a 5-byte header (type + u32 channel). Channels are numbered by the relay per room.
- **Newest daemon connection wins.** A daemon whose NAT dropped the old socket must not wait for the liveness timeout; only the key holder can authenticate, so replacing is safe.
- **Errors as WebSocket close codes after the upgrade** (4004 no daemon, 4030 room full, …) because React Native's WebSocket hides HTTP statuses; cheap refusals before the upgrade (malformed ID `400`, IP limits `429`).
- **Bandwidth as a token bucket that delays.** The reader waits for tokens before forwarding, which pushes back through TCP instead of dropping frames that the Noise layer would then fail to decrypt. Buckets are kept per daemon ID across reconnects and dropped once full and unused.
- **Backpressure:** device → daemon writes block the device's reader (the daemon connection is the shared resource); daemon → device goes through a bounded per-device queue so one slow device cannot stall the room, and overflow closes that device (4031).
- **Library:** `github.com/coder/websocket` (context-based, concurrent writes, read limits, ping) with compression disabled.
- **Close codes:** 1009 too big, 1012 restart, 4000 bad frame, 4001 bad signature, 4003 dropped by daemon, 4004 daemon offline, 4008 handshake timeout, 4009 replaced, 4010 idle, 4030 room full, 4031 slow device, 4100–4199 passed through from the daemon.
- **Deploy:** the US server builds the image from the sources copied over SSH (architecture-agnostic, mirrors `deploy-web`); Fly builds from the same Dockerfile. Fly machines never auto-stop: the relay holds long-lived connections.

## Risks / Trade-offs

- Room IDs are guessable by anyone who saw a pairing code → joining a room gives only a Noise handshake the daemon refuses; the per-room device cap and per-IP limits bound the cost.
- A restart drops every session → both sides reconnect on 1012; acceptable for a stateless relay.
- In-memory limits reset on restart → acceptable; they bound abuse, they do not bill.
