## Why

The app needs Tailscale on both sides, which blocks store distribution and takes the phone's VPN slot (#362). The first piece of its replacement is the connection relay itself (#363): a server that forwards end-to-end encrypted traffic between a daemon and its devices without ever being able to read it (ADR-0001), written in Go over binary WebSocket (ADR-0003), hosted by the project in two regions and easy to self-host.

## What Changes

- New `apps/relay` Go module (`github.com/maarkN/remote-harness/apps/relay`): an HTTP server with `/healthz`, a daemon endpoint and a device endpoint, wired into the monorepo checks through a `package.json` whose `typecheck` runs `go vet` and whose `test` runs `go test`, so `pnpm check` (and CI, which installs Go) covers it.
- Rooms keyed by daemon ID (the first 16 bytes of the SHA-256 of the daemon's Ed25519 relay key, in hex). A daemon opens its room by signing a random challenge from the relay; only the holder of that key can open it. Devices join a room by daemon ID; the relay forwards their binary frames to the daemon over one multiplexed connection and back, opaquely.
- Limits from the environment, looked up per daemon ID so a future subscription can raise them: 10 concurrent devices per room, connection rate and concurrent connections per IP, a deadline for the daemon's challenge answer, a bandwidth limit per room, 8 MB maximum frame, an idle timeout for device channels and a liveness timeout for every connection.
- No payload logging; client IPs only live in memory while the rate limits need them.
- Graceful shutdown closes every connection with WebSocket code 1012 (service restart) so both sides reconnect.
- Docker image (static binary, non-root); `apps/relay/deploy/compose.yml` behind the US server's Traefik for `us.relay.remoteharness.app`, deployed with `make deploy-relay`; `apps/relay/fly.toml` for `br.relay.remoteharness.app` in Fly.io `gru`, deployed with `make deploy-relay-br`.
- Docs: a "Self-hosting the connection relay" section on the daemon page in en-US, pt-BR and es-ES, and the relay deploy steps in `CONTRIBUTING.md`.

## Capabilities

### New Capabilities

- `connection-relay`: the relay server's endpoints, room ownership challenge, frame format, forwarding, limits, logging rules, shutdown and its deploys.

### Modified Capabilities

- `web-docs`: the daemon page documents self-hosting the connection relay, and the relay deploy is one of the developer topics in `CONTRIBUTING.md`.

## Impact

- New `apps/relay/` (Go 1.25+ module, `github.com/coder/websocket`), `pnpm-workspace.yaml` already globs `apps/*`.
- `.github/workflows/ci.yml` (setup-go before `pnpm check`), `Makefile` (`deploy-relay`, `deploy-relay-br`), `CONTRIBUTING.md`, `apps/web/content/*/daemon.md`.
- No change yet to the daemon or the app: they start using the relay in #365 and #366.
- Operations (owner): DNS-only Cloudflare records for `us.relay` (the US server) and `br.relay` (Fly), `fly launch`/`fly certs add` once.
