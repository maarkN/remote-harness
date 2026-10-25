## 1. Storage and store

- [x] 1.1 Computers index and per-computer items, migration of the single item (pure logic + tests).
- [x] 1.2 Connection store with `computers`, `activeId`, add / select / forget / update paths; `daemon.paths` persisted.

## 2. Client

- [x] 2.1 `connectionTargets` (direct, home relay, other relays) and per-target timeouts; 4004 not final (tests).
- [x] 2.2 Direct probe and swap while on the relay; `path` exposed (tests with fake sockets).
- [x] 2.3 Pairing tries the code's relay after its direct addresses (tests).

## 3. Push

- [x] 3.1 Daemon: `daemonId` in push data and `?computer=` in the live status link (tests).
- [x] 3.2 App: payload with `daemonId`, taps switch computer, background answers use the notification's computer (tests).

## 4. UI

- [x] 4.1 Computer switcher from the machine line.
- [x] 4.2 Settings → Computers (list, rename, forget) and Machine card path line.
- [x] 4.3 Settings → Devices (list, Add device with QR, revoke); 4007 signs this device out of that computer.
- [x] 4.4 i18n pt-BR / en-US / es-ES (parity tests).

## 5. Docs

- [x] 5.1 Using the app (computers, devices, paths) in three languages.

## 6. Validation

- [x] 6.1 `turbo run typecheck test`, Biome, `npx expo export --platform ios`.
