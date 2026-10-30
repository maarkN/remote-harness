## Why

The app reaches the daemon over plain `ws://` with one shared bearer token, which was only acceptable because WireGuard (Tailscale) encrypted the link; a leaked pairing QR works forever and rotating the token logs every phone out (#364, part of #362). Before the connection relay can carry any traffic (ADR-0001), every connection needs its own end-to-end encryption and every device its own key (ADR-0002).

## What Changes

- **BREAKING** `PROTOCOL_VERSION` 2: every WebSocket carries the Noise Protocol Framework (X25519, ChaCha20-Poly1305, SHA-256) instead of plain JSON. A device pairs with `Noise_XXpsk3_25519_ChaChaPoly_SHA256` (the pairing secret is the PSK) and reconnects with `Noise_IK_25519_ChaChaPoly_SHA256`. The JSON protocol runs unchanged inside the encrypted channel; `auth` no longer carries a token.
- One pure implementation in `packages/protocol` (handshake, connection preface, chunked transport frames, pairing code format) with the primitives injected, plus the official Noise test vectors that the protocol, daemon and app test suites all run. The daemon injects Node `crypto`, the app `react-native-quick-crypto`.
- Daemon identity: a Noise static key pair and an Ed25519 relay key pair (its daemon ID is the hash of the latter, as the connection relay expects), created at first start and kept in the existing secret store (Keychain, Secret Service or 0600 file).
- **BREAKING** Pairing codes replace the token: `remoteharness://pair?v=2&id=…&k=…&s=…&a=…&n=…` with the daemon ID, its static key, a single-use secret that expires after 5 minutes, its addresses and machine name. `remote-harness pair`, the setup and the tray ask the running daemon for a code.
- The daemon keeps the paired devices (key, name, platform, paired at; at most 10) and only accepts IK from a paired key.
- **BREAKING** The token, `rotate-token`, `POST /admin/reload-token` and the tray's "Rotate token…" are removed; `doctor` checks the daemon identity instead of the token. Existing pairings are not migrated: the app asks to pair again.
- App: generates its device key pair at pairing (SecureStore, this device only), stores the daemon's key and ID, pairs from a scanned or pasted pairing link (the manual host/port/token form goes away), and speaks Noise in `DaemonClient`.
- i18n (pt-BR, en-US, es-ES) for the new CLI, tray and app texts.

## Capabilities

### New Capabilities

### Modified Capabilities

- `daemon-auth`: end-to-end encrypted channel replaces the mandatory token; pairing codes replace pairing and rotation; key storage replaces token storage; paired devices.
- `app-pairing`: pairing from the new code (scan or paste), device keys in SecureStore, pair again after the protocol change.
- `protocol`: protocol version 2 negotiated by the connection preface and `auth` without a token.

## Impact

- `packages/protocol/src/noise/*` (new), `index.ts`, `client.ts` (`auth`), test vectors and tests.
- Daemon: `core/identity.ts`, `features/pairing/` (codes, paired devices), `transport/ws-server.ts`, `main.ts`, `cli.ts` (`pair`, `doctor`, `rotate-token` removed), `features/setup/wizard.ts`, tray menu, `core/secrets.ts`, `core/pairing.ts`, i18n, tests.
- App: `react-native-quick-crypto` (+ `react-native-nitro-modules`, `react-native-quick-base64`) via `npx expo install`; `core/crypto/`, `core/storage/credentials.ts`, `core/connection/daemon-client.ts`, `short-lived.ts`, `features/pairing/*`, i18n, tests.
- Docs: daemon page (commands, tray), getting started (pairing), security page (keys instead of the token) in the three languages.
