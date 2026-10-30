## 1. App

- [x] 1.1 `orderTargets(targets, lastGood)` in `daemon-client.ts` and its use in `open()`, remembering the URL that completed `auth` (also after a direct probe); tests
- [x] 1.2 Heartbeat in `DaemonClient`: last-received time, `ping` after 30 s of quiet, drop and reconnect when no reply within 10 s, quiet timeout (no request error listener), stopped on close/drop; tests with the fake socket and fake timers

## 2. Daemon

- [x] 2.1 `directAddresses` leaves out container and virtual bridge interfaces; tests

## 3. Verify

- [x] 3.1 Typecheck, tests and Biome green
