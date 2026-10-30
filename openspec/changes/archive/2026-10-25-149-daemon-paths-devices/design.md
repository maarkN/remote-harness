## Context

After #364 every connection is a Noise channel accepted by `transport/secure-connection.ts` over any byte `Link`; the daemon still binds to the Tailscale address only. The relay (#363) multiplexes device channels on one daemon WebSocket (`OPEN`/`DATA`/`CLOSE` frames, Ed25519 challenge).

## Goals / Non-Goals

**Goals:** both paths live at once on the daemon with one code path for the channel; a stable home relay; device list and revoke; fewer bytes per update.

**Non-Goals:** the app's path switching and device screens (#366); deleting the remaining Tailscale code and texts (#367; `--wait-tailscale` stays as a no-op until then).

## Decisions

- **One connection code for both paths.** The relay client turns each `OPEN` into a `Link` (`DATA` in and out, `CLOSE` both ways) and hands it to `acceptSecureConnection`, exactly like a direct WebSocket.
- **Close codes over the relay**: the relay only passes 4100–4199 from the daemon (#363), so the daemon adds 100 to its 4000–4099 codes on the relay path and the app subtracts 100 (`normalizeChannelClose`).
- **Latency by `GET /healthz`** over HTTPS (the relay's own endpoint), best of two, 3 s timeout: cheap, no room opened while measuring. Selection and failover are pure functions with the measurements as input.
- **Sticky home relay**: reconnect to the same relay with backoff (1 s → 30 s); re-measure only after three consecutive failures, so a relay restart (1012) does not move the room.
- **Bind `::`** (falls back to `0.0.0.0` where IPv6 is unavailable): the Noise channel is the protection, and the direct path must work on the LAN and on a tailnet without Tailscale-specific code. macOS may ask once to accept incoming connections.
- **Advertised addresses** from `os.networkInterfaces()`: no loopback, no link-local (`169.254/16`, `fe80::/10`); IPv4 first; at most 8.
- **Devices**: `lastSeen` written when a device authenticates (one atomic write per connection). Revocation emits `device.revoked` on the bus: the hub closes that device's connections (connections now carry their `deviceId`), the push feature drops its registration.
- **Push**: a registration records the paired device that sent it; one per device, so the cap becomes the paired-device cap (10). At start, registrations without a known device are dropped (protocol-1 registrations included).
- **Traffic**: entries of one `sync()` go in one `transcript.entries`; pane diffs compare lines with the last frame sent and fall back to a full frame when the size changes or more than half the lines changed; session deltas compare the wire form of the previous and next record; a resume beyond 200 lines answers the last page (the app already replaces on `hasMore` and pages older history on scroll).

## Risks / Trade-offs

- Listening on all interfaces exposes a port on the LAN → every byte before a valid IK from a paired key is refused, with the handshake deadline; the hooks server stays on loopback.
- A stale home relay measurement → the daemon re-measures on failover; devices try the other relays by daemon ID (#366).
- `pane.diff` requires the app to hold the last frame → the daemon always starts each viewer with a full frame, and after any reconnect the app re-subscribes.
