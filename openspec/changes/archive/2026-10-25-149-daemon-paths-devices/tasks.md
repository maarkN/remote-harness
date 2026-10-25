## 1. Protocol

- [x] 1.1 Schemas: `devices.list`, `devices.revoke`, `pairing.create`, `devices.result`, `pairing.code`, `daemon.paths`, `auth.ok.paths`, `transcript.entries` (replaces `transcript.entry`), `pane.diff`, `session.changed`; `CHANNEL_CLOSE.revoked`, relay offset and `normalizeChannelClose` (tests).

## 2. Traffic

- [x] 2.1 `transcript.entries` per read (tests).
- [x] 2.2 Paged resume: at most 200 lines after the cursor, else the last page with `hasMore` (tests).
- [x] 2.3 Pane diffs with full frames for new viewers, size changes and big changes (pure diff + streamer tests).
- [x] 2.4 `session.changed` deltas (pure diff + store tests).
- [x] 2.5 Byte counts before/after for the #355 scenario (test printing the table).

## 3. Devices

- [x] 3.1 `lastSeen`, `revoke`, `device.revoked` event; connections carry `deviceId`; revoked connections closed with 4007 (tests).
- [x] 3.2 `devices.list`, `devices.revoke`, `pairing.create` handlers (integration tests).
- [x] 3.3 CLI `devices list` / `devices revoke <id>` through admin routes; i18n pt-BR / en-US / es-ES.
- [x] 3.4 Push registrations per paired device, cap 10, dropped on revoke and at start when unknown (tests).

## 4. Paths

- [x] 4.1 Config `relays`, `relay`, `direct` with validation (tests).
- [x] 4.2 Pure home relay selection and failover; latency measurement (tests).
- [x] 4.3 Direct addresses from the interfaces (tests); bind `::` with fallback; `direct: off`.
- [x] 4.4 Relay client: challenge, `OPEN`/`DATA`/`CLOSE` links into `acceptSecureConnection`, close codes +100, reconnect and failover (tests against the Go relay's protocol with a fake relay).
- [x] 4.5 `paths` in `auth.ok`, `daemon.paths` broadcasts, pairing codes with all addresses and the home relay.

## 5. App

- [x] 5.1 Apply `transcript.entries`, `pane.diff` (pure helper with tests) and `session.changed` (tests); close codes 4007 and 41xx.

## 6. Docs

- [x] 6.1 Daemon page (config keys, `devices` commands, paths) and security page in three languages.

## 7. Validation

- [x] 7.1 `turbo run typecheck test`, Biome, `npx expo export --platform ios`.
