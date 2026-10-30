## Context

Keepalives today: the relay pings both its daemon and its devices every 25 s (20 s pong deadline) and closes a device channel after 10 minutes without a message (`IdleTimeout`); the daemon's relay client terminates after 90 s of silence; the daemon's WebSocket server pings direct clients every 30 s. Relay pings are answered by the phone's OS WebSocket stack and never reach JavaScript, so they keep NAT mappings alive but do not reset the channel idle timer nor tell the app anything.

The issue could not be reproduced on a provider from here; the changes below follow from the code and from typical cloud idle timeouts (AWS NAT gateway 350 s, GCP Cloud NAT 1200 s, load balancers 60–350 s), all longer than the 25–30 s keepalives.

## Goals / Non-Goals

**Goals:** a connection on the relay path stays up while the app is open; a dead connection is noticed within ~40 s and replaced; reconnecting from away does not wait on unreachable addresses.

**Non-Goals:** changing the relay (`IdleTimeout` still frees abandoned channels); background keepalive (iOS suspends the app); persisting the last good path across app restarts.

## Decisions

- **Heartbeat only when quiet.** A `ping` request goes out when nothing has been received for `HEARTBEAT_MS` (30 s), checked on a 30 s interval; a busy session costs nothing extra. The reply deadline is `HEARTBEAT_TIMEOUT_MS` (10 s); missing it drops the socket without waiting for a close handshake (it would hang on a half-open connection) and goes through the normal close path, so pending requests fail as `disconnected` and the reconnect starts. The heartbeat's timeout is not reported to request error listeners (no error toast for it).
- **Last good target first.** `orderTargets(targets, lastGood)` moves the URL that last completed `auth` to the front; the rest keep their order. Pure and tested. The backoff keeps counting rounds over the same list.
- **Bridge filter by interface name.** Container and hypervisor bridges have well-known name prefixes; filtering by name keeps real NICs, VPNs (`tailscale0`, `utun*`, `wg*`) and Wi-Fi. Alternative considered: filtering private ranges such as 172.17.0.0/16 — rejected, those ranges are also used by real networks.

## Risks / Trade-offs

- [A slow daemon reply on a busy computer trips the heartbeat] → 10 s is far above a `pong`'s cost; the worst case is one extra reconnect.
- [Starting with the relay when back home] → the direct probe moves the connection within 30 s, or at once when the app returns to the foreground.
