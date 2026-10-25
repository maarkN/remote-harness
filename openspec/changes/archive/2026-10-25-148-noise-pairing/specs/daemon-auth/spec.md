## ADDED Requirements

### Requirement: End-to-end encrypted channel
Every WebSocket connection to the daemon SHALL be a Noise Protocol Framework session (X25519, ChaCha20-Poly1305, SHA-256) and carry only binary messages. The device's first message MUST be the connection preface — the bytes `0x52 0x48`, the preface version `0x02`, the mode (`0x01` pair, followed by the 16-byte pairing ID; `0x02` reconnect) — followed by the first handshake message. Pairing SHALL use `Noise_XXpsk3_25519_ChaChaPoly_SHA256` with the pairing secret as PSK, reconnecting `Noise_IK_25519_ChaChaPoly_SHA256` with the daemon's static key from the pairing code. The prologue SHALL be the ASCII `remote-harness noise v1`, a zero byte and the preface, so the preface cannot be altered. After the handshake every WebSocket message SHALL be one Noise transport message of at most 65,535 bytes whose plaintext is a flag byte (`0x00` last chunk, `0x01` more follow) and a chunk of one protocol message (UTF-8 JSON) of at most 8 MB. The daemon MUST NOT send any protocol message before it has received and decrypted the device's `auth`, MUST close a connection that has not completed the handshake within 5 seconds (4008), that sends text or a preface it does not know (4002), whose handshake or any frame fails to decrypt (4001) or whose reconnecting key is not a paired device (4001).

#### Scenario: Reconnect with a paired key
- **WHEN** a paired device completes IK and sends `auth`
- **THEN** the daemon answers `auth.ok` inside the encrypted channel

#### Scenario: Unknown device key
- **WHEN** a device that was never paired starts IK with the daemon's static key
- **THEN** the daemon closes the connection with 4001 and sends no protocol message

#### Scenario: Tampered frame
- **WHEN** one byte of a transport message is changed in transit
- **THEN** decryption fails and the daemon closes the connection with 4001

#### Scenario: Replayed frame
- **WHEN** a transport message is delivered a second time
- **THEN** it fails to decrypt (its nonce was used) and the connection is closed

#### Scenario: Old app
- **WHEN** an app speaking protocol 1 sends its JSON `auth` as a text message
- **THEN** the daemon closes the connection with 4002

### Requirement: Pairing codes
A pairing code SHALL be the link `remoteharness://pair?v=2&id=<daemon ID>&k=<daemon static key>&s=<secret>&a=<host:port>&n=<machine name>` (keys and secret in unpadded base64url, `a` repeated per address, an optional `r=<connection relay URL>`), with a 32-byte random secret whose pairing ID is the first 16 bytes of SHA-256 of `remote-harness pairing id`, a zero byte and the secret. The daemon SHALL keep its codes in memory only, accept each one for one successful pairing within 5 minutes of its creation and then forget it; an unknown, used or expired code, or a wrong secret, MUST close the connection with 4005, and an 11th device with 4006. `remote-harness pair`, the setup and the tray SHALL ask the running daemon for a code (the tray reuses its current code while more than a minute is left), and `pair` SHALL say that the daemon must be running when it is not. The token, `rotate-token` and `POST /admin/reload-token` SHALL no longer exist.

#### Scenario: Pair with a fresh code
- **WHEN** a device completes XXpsk3 with the secret of a code shown 2 minutes ago and sends its name and platform
- **THEN** the daemon records the device and answers `auth.ok`

#### Scenario: Code used twice
- **WHEN** a second device tries the same code after a successful pairing
- **THEN** the daemon closes the connection with 4005

#### Scenario: Expired code
- **WHEN** a device tries a code created 6 minutes ago
- **THEN** the daemon closes the connection with 4005

#### Scenario: Daemon not running
- **WHEN** the user runs `remote-harness pair` while the daemon is stopped
- **THEN** the command says the daemon must be running and shows no code

### Requirement: Paired devices
The daemon SHALL keep each paired device's static public key, a short ID derived from it, its name, platform and pairing time in `~/.remote-harness/paired-devices.json`, at most 10 devices, and accept a reconnecting device only when its static key is in that list.

#### Scenario: Restart
- **WHEN** the daemon restarts
- **THEN** devices paired before reconnect with IK without pairing again

### Requirement: Key storage
The daemon's identity — its Noise static key pair and its Ed25519 connection relay key pair, whose daemon ID is the first 16 bytes of SHA-256 of the relay public key in hex — SHALL be created at first start and stored in the secret store (macOS Keychain, Linux Secret Service, or a 0600 file where neither exists), never in plain text elsewhere. `remote-harness doctor` SHALL report whether the identity exists.

#### Scenario: Persisted identity
- **WHEN** the daemon restarts
- **THEN** it has the same static key and daemon ID, so paired devices keep working

## REMOVED Requirements

### Requirement: Mandatory token
**Reason**: Replaced by the end-to-end encrypted channel with per-device keys (ADR-0002).
**Migration**: Pair each device again with a new pairing code.

### Requirement: Pairing and rotation
**Reason**: A long-lived token in the QR worked forever and rotation logged everyone out; pairing codes are single-use and short-lived.
**Migration**: Use `remote-harness pair` for a new code; revoking one device arrives with the device list (#365).

### Requirement: Token storage
**Reason**: There is no token anymore; the daemon's keys take its place in the same store.
**Migration**: None; the old token entry is no longer read.
