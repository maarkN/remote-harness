## 1. Protocol

- [x] 1.1 `noise/crypto.ts`: `NoiseCrypto` and `createNoiseCrypto` over a Node-compatible `crypto` module (raw X25519 via DER prefixes).
- [x] 1.2 `noise/handshake.ts`: CipherState, SymmetricState, HandshakeState for `XXpsk3` and `IK`; cacophony vectors pass (tests).
- [x] 1.3 `noise/channel.ts`: preface, prologue, pairing ID, device and daemon handshakes, chunked transport session (tests: round trip, chunking, tamper, replay, wrong daemon key, wrong PSK, oversize).
- [x] 1.4 `noise/pairing-code.ts`: format and parse the pairing code, legacy detection (tests).
- [x] 1.5 `PROTOCOL_VERSION` 2, `auth` without token; vectors exported for the other suites.

## 2. Daemon

- [x] 2.1 `core/identity.ts`: create/load the identity in the secret store; daemon ID (tests).
- [x] 2.2 `features/pairing/`: pairing codes (single use, 5 min, tray reuse) and paired devices file (max 10) (tests).
- [x] 2.3 `ws-server.ts` over Noise: preface, XXpsk3/IK, deadline, close codes, chunked frames, `auth` gate (tests with a Noise test client).
- [x] 2.4 `main.ts`, `cli.ts` (`pair` via `/admin/pairing-code`, `doctor` identity, `rotate-token` and reload route removed), setup wizard, tray menu; i18n in the three languages.
- [x] 2.5 Daemon tests moved to the Noise test client; vectors run in the daemon suite.

## 3. App

- [x] 3.1 `npx expo install react-native-quick-crypto react-native-nitro-modules react-native-quick-base64`; `core/crypto` adapter; vectors run in the app suite.
- [x] 3.2 Credentials: new SecureStore item, legacy detection (tests).
- [x] 3.3 `DaemonClient` over Noise (binary socket, pairing and reconnect handshakes, final close codes) (tests with a fake daemon).
- [x] 3.4 Pairing: parse codes from QR, deep link and pasted link; generate the device key; pair-again notice; error texts; i18n in the three languages.
- [x] 3.5 `short-lived.ts` and background actions use IK.

## 4. Docs

- [x] 4.1 Daemon, getting-started and security pages (three languages): pairing codes, keys, no token; `SECURITY.md` and `CLAUDE.md` security line.

## 5. Validation

- [x] 5.1 `turbo run typecheck test`, Biome and `npx expo export --platform ios` green.
