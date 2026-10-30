## Why

With the relay server (#363) and the Noise channel (#364) in place, the daemon still only listens on the Tailscale address and knows its devices only as keys (#365, part of #362). It must reach devices from anywhere through its home connection relay, also accept them directly on any interface, let the user see and revoke devices, and send less over the wire now that relay traffic costs bandwidth and latency.

## What Changes

- **Relay path**: at start the daemon measures the latency to the relays in `relays` (default `wss://us.relay.remoteharness.app`, `wss://br.relay.remoteharness.app`), opens its room on the fastest with the Ed25519 challenge, keeps it (switches only when it goes down) and serves each device channel through the same Noise connection code as the direct path. Daemon close codes travel as 4100–4199 through the relay.
- **Direct path**: the WebSocket listens on all interfaces (`::`, or `0.0.0.0` without IPv6) instead of the Tailscale address; only Noise-authenticated paired keys get anything. The daemon advertises its direct addresses and home relay in `auth.ok` and `daemon.paths`, and the pairing code carries both.
- Config: `relays` (list), `relay: "off"`, `direct: "off"` (not both).
- **Devices**: the paired-device list records `lastSeen`; `devices.list`, `devices.revoke` and `pairing.create` messages; revoking closes that device's connections with 4007 and refuses its key. CLI `devices list` / `devices revoke <id>` (admin routes); `pair` and the tray already use single-use codes.
- **Push** registrations belong to a paired device: one per device, up to the 10 paired devices (replaces the cap of 3); registrations of revoked or unknown devices are dropped.
- **BREAKING (within protocol 2)** Wire traffic: `transcript.entries` batches the entries of one read; `pane.diff` sends changed lines after a full `pane.frame` (still at most 4 per second); `session.changed` carries only the changed fields after the first `session.updated`; a resume that would exceed 200 lines answers the last page instead of up to 2,000 lines. The app applies all four.
- i18n (pt-BR, en-US, es-ES) for the CLI and tray texts; docs for the paths, the config keys and the device commands.

## Capabilities

### New Capabilities

- `connection-paths`: home relay selection and failover, the relay path, direct addresses and their advertisement.

### Modified Capabilities

- `daemon-auth`: the direct path replaces the Tailscale-only bind; paired devices gain `lastSeen`, listing and revocation; pairing codes on request from a device.
- `daemon-config`: `relays`, `relay` and `direct`.
- `push-notifications`: registrations follow the paired devices.
- `transcript-stream`: batched entries and paged resume.
- `raw-terminal`: pane line diffs.
- `session-registry`: field deltas.
- `protocol`: new messages in the catalog.

## Impact

- `packages/protocol` (`server.ts`, `client.ts`, `domain.ts`, `noise/channel.ts` close codes).
- Daemon: `features/connectivity/` (new: relays, measurement, addresses, relay client, service), `features/pairing/` (devices, revoke, `pairing.create`, admin routes), `features/push/devices.ts`, `features/transcript/`, `features/pane/streamer.ts`, `features/sessions/store.ts`, `transport/connection.ts`, `secure-connection.ts`, `ws-server.ts`, `main.ts`, `cli.ts`, `core/config.ts`, i18n, tests.
- App: `features/conversation/store.ts`, `features/sessions/store.ts`, `features/terminal/`, `core/connection/daemon-client.ts` (relay close codes, revoked).
- Docs: daemon page (config, commands, paths), security page.
