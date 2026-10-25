## Context

Today `ws-server.ts` accepts plain JSON and checks a bearer token in `auth`; the app keeps `{host, port, token}`. ADR-0001 needs end-to-end encryption on every path (the relay path arrives in #365) and ADR-0002 per-device keys. The relay (#363) routes by daemon ID = hash of an Ed25519 key.

## Goals / Non-Goals

**Goals:** one audited-by-vectors Noise implementation shared by the daemon and the app; native primitives on both sides; fail closed; the existing JSON protocol untouched inside the channel.

**Non-Goals:** the relay path, advertised addresses and the full device list with revoke and `pairing.create` (#365); several computers in the app (#366); removing Tailscale (#367).

## Decisions

- **Pure Noise in `packages/protocol/src/noise`, primitives injected.** `NoiseCrypto` (X25519 DH, ChaCha20-Poly1305, SHA-256, HMAC, random) is built by `createNoiseCrypto(crypto)` from any Node-compatible `crypto` module: `node:crypto` in the daemon, `react-native-quick-crypto` in the app (same API). Raw X25519 keys go in and out through fixed DER prefixes (PKCS#8 / SPKI), supported by both. Tests inject `node:crypto` everywhere, so the cacophony vectors for `XXpsk3` and `IK` run in the protocol, daemon and app suites.
- **XXpsk3 for pairing, IK for reconnects.** XX lets the daemon learn the new device key; `psk3` binds the handshake to the pairing secret so only someone who saw the code can finish it, and the device checks the daemon static key it receives against the code. IK is one round trip and encrypts the device's identity. A replayed IK first message gets a reply nobody can decrypt; the daemon still waits for the first transport message (`auth`) before sending anything, which proves the device holds its ephemeral key.
- **Connection preface outside Noise, bound by the prologue.** `RH`, version, mode and (pairing) the pairing ID let the daemon pick the pattern and the PSK before the first handshake message; putting the preface into the prologue makes tampering fail the handshake. The pairing ID is a hash of the secret, so it identifies the code without revealing it.
- **Chunked transport.** Noise caps a message at 65,535 bytes; protocol messages reach 8 MB (an image attachment). Each WebSocket message is one Noise message whose first plaintext byte says whether more chunks follow. One WebSocket message per chunk also maps one-to-one onto relay frames.
- **Two daemon key pairs.** X25519 for Noise, Ed25519 for the relay challenge (X25519 cannot sign, and Node cannot convert between the curves). Both live in one secret-store entry (`daemon-identity`, base64url of the four 32-byte values).
- **Codes in daemon memory.** The CLI asks the daemon (`POST /admin/pairing-code`, hooks server, local secret) so a code only exists in the process that can accept it; a restart invalidates them. The tray reuses its current code while it has over a minute left, because the menu is rebuilt often.
- **Close codes:** 4001 unauthorized (failed decrypt, unknown key), 4002 protocol mismatch (text, unknown preface), 4005 pairing refused (unknown/used/expired code, wrong secret), 4006 device limit, 4008 handshake timeout. The app treats 4001/4002/4005/4006 as final.
- **Device-side storage.** One SecureStore item (`remote-harness.computer`) with the device key pair, the daemon key and ID, addresses, optional relay and name; #366 turns it into a list. A legacy item with a token is deleted and the pair-again notice shown.

## Risks / Trade-offs

- A bug in our own Noise code would be serious → the official vectors, tamper/replay/wrong-key tests, and only well-known primitives from the platforms.
- `react-native-quick-crypto` is a native module → development and store builds need a rebuild; the API is exercised in Vitest through the Node stand-in, and `expo export` validates the bundle. Device verification stays a manual step.
- Every device must pair again → stated in the app, the docs and the release notes.
