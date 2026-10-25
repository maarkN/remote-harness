## 1. Module

- [x] 1.1 `apps/relay` Go module with `github.com/coder/websocket`, `package.json` (`typecheck` = `go vet ./...`, `test` = `go test ./...`); CI installs Go from `go.mod`.

## 2. Server

- [x] 2.1 Config from the environment with defaults and validation (tests).
- [x] 2.2 Token bucket and per-IP limiter with an injected clock, entries dropped when idle (tests).
- [x] 2.3 Frame encoding/decoding for the daemon connection and the challenge signature (tests).
- [x] 2.4 Endpoints: `/healthz`, `/v1/daemon` (challenge, room, replace), `/v1/device/<id>` (join, forward, close codes).
- [x] 2.5 Limits: devices per room, IP rate and concurrency, handshake deadline, bandwidth, max frame, device queue, idle timeout, liveness ping.
- [x] 2.6 Graceful shutdown with 1012; `main.go` with signals; JSON logs without payloads or IPs.
- [x] 2.7 Integration tests: ownership challenge (good, forged, other key, late), round trip, two devices, daemon CLOSE, no daemon, replace, every limit, idle timeout, oversize frame, shutdown.

## 3. Deploy

- [x] 3.1 Dockerfile (static binary, non-root, health check) and `.dockerignore`; image builds.
- [x] 3.2 `deploy/compose.yml` (Traefik, `us.relay.remoteharness.app`), `scripts/deploy.sh`, `make deploy-relay`.
- [x] 3.3 `fly.toml` (`gru`, always on, `Fly-Client-IP`), `make deploy-relay-br`.

## 4. Docs

- [x] 4.1 "Self-hosting the connection relay" on the daemon page in en-US, pt-BR and es-ES.
- [x] 4.2 `CONTRIBUTING.md`: deploying both relays (DNS-only records, Fly certificate).

## 5. Validation

- [x] 5.1 `turbo run typecheck test` and Biome green; web docs test green.
