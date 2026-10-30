## 1. Protocol

- [x] 1.1 `permissions.list` (client) and `permissions.result { replyTo, requests }` (server), with samples in the protocol tests

## 2. Daemon

- [x] 2.1 Answer `permissions.list` with the broker's pending list (the replay on connect stays)
- [x] 2.2 Integration test: a connected client lists the pending request

## 3. App

- [x] 3.1 `bindPermissions`: no clear on ready; sync from `permissions.list` on ready and when bound to an open connection; older daemons keep what the reconnect replayed
- [x] 3.2 Vitest: replay before ready on a cold start, stores bound after the connection opened, reconnect with a request answered meanwhile, no repeated haptic, older daemon, resolved request

## 4. Verify

- [x] 4.1 `turbo run typecheck test` and Biome green
- [x] 4.2 Relaunch the app against the demo with a pending request: strip, row badge and session card show it
