---
status: accepted
---

# The connection relay is written in Go and speaks WebSocket, not gRPC

Everything else in the monorepo is TypeScript, but the connection relay only forwards ciphertext (ADR-0001), so it needs nothing from `packages/protocol` and gains from Go's single static binary, low memory per open connection and trivial Docker image, which also makes self-hosting easy. We rejected gRPC: React Native has no native gRPC client (no HTTP/2 trailers in `fetch`, grpc-web needs a proxy), the Cloudflare proxy in front of the server complicates it further, and typed schemas buy nothing for an opaque bidirectional pipe. Binary WebSocket frames work natively in the app, in Node and in Go, and pass through Traefik and Cloudflare; security lives in the end-to-end layer, not the transport. The same container runs in two regions from the start: on the existing US server next to `apps/web` behind Traefik, for users in the US, and on Fly.io in São Paulo (`gru`), because a relay path through the US costs Brazilian users about 240 ms per round trip.
