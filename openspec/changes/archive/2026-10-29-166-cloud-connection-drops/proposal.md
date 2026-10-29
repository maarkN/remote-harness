## Why

The connection between the app and a daemon on a cloud server was reported as unstable (#442). Reading the paths end to end shows three causes that hit a cloud computer hardest, because its WebSocket port is usually closed and every connection goes through the connection relay:

- The relay closes a device channel after 10 minutes with no message in either direction (4010). A quiet session on the relay path is dropped every 10 minutes; at home the direct path has no such timeout.
- After every drop the app tries each direct address first, 3 s apiece, before the relay. A cloud computer advertises its private address plus container bridges (`docker0`, `br-…`), so each reconnect stalls for up to 24 s on addresses a phone can never reach.
- The app has no liveness check of its own: when a NAT or load balancer silently drops the mapping, the socket looks open until the OS gives up, and requests just time out.

## What Changes

- App heartbeat: while connected, when nothing has arrived for 30 s the app sends `ping`; no reply within 10 s drops the connection and reconnects right away. The traffic also keeps the relay channel from going idle.
- Reconnect order: a new round starts with the target that last completed `auth` (e.g. the relay away from home), then the others in the usual order. Coming home is still covered by the direct probe every 30 s and on foreground.
- Direct addresses: the daemon no longer advertises addresses of container and virtual bridge interfaces (`docker*`, `br-*`, `veth*`, `virbr*`, `cni*`, `flannel*`, `cali*`, `vxlan*`, `podman*`, `lxdbr*`, `lxcbr*`).
- Findings documented for the cloud server docs page (#441).

## Capabilities

### New Capabilities

### Modified Capabilities
- `app-computers`: heartbeat and reconnect order in path selection.
- `connection-paths`: container bridges left out of the direct addresses.

## Impact

- App: `src/core/connection/daemon-client.ts` (heartbeat, target order), tests.
- Daemon: `features/connectivity/addresses.ts`, tests.
- No protocol change (`ping`/`pong` exist); no relay change or deploy.
