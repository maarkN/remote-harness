## MODIFIED Requirements

### Requirement: End-to-end encrypted channel
Every WebSocket connection to the daemon SHALL be a Noise Protocol Framework session (X25519, ChaCha20-Poly1305, SHA-256) and carry only binary messages. The device's first message MUST be the connection preface — the bytes `0x52 0x48`, the preface version `0x02`, the mode (`0x02` reconnect; `0x03` announce, followed by the 16-byte pairing ID and nothing else; `0x04` pair, followed by the 16-byte pairing ID) — followed by the first handshake message, except for an announce. Pairing SHALL use `Noise_XXpsk3_25519_ChaChaPoly_SHA256` with the PSK `HMAC-SHA256(secret, "remote-harness pairing confirmation" ‖ 0x00 ‖ the six confirmation digits)`, reconnecting `Noise_IK_25519_ChaChaPoly_SHA256` with the daemon's static key from the pairing code. The prologue SHALL be the ASCII `remote-harness noise v1`, a zero byte and the preface, so the preface cannot be altered. After the handshake every WebSocket message SHALL be one Noise transport message of at most 65,535 bytes whose plaintext is a flag byte (`0x00` last chunk, `0x01` more follow) and a chunk of one protocol message (UTF-8 JSON) of at most 8 MB. The daemon MUST NOT send any protocol message before it has received and decrypted the device's `auth`, MUST close a connection that has not completed the handshake within 5 seconds (4008), that sends text, a preface it does not know or the pairing mode `0x01` of apps without confirmation codes (4002), whose handshake or any frame fails to decrypt (4001) or whose reconnecting key is not a paired device (4001).

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

#### Scenario: App without confirmation codes
- **WHEN** a device starts a pairing with the preface mode `0x01`
- **THEN** the daemon closes the connection with 4002 before any handshake message

### Requirement: Pairing codes
A pairing code SHALL be the link `remoteharness://pair?v=2&id=<daemon ID>&k=<daemon static key>&s=<secret>&a=<host:port>&n=<machine name>` (keys and secret in unpadded base64url, `a` repeated per address, an optional `r=<connection relay URL>`), with a 32-byte random secret whose pairing ID is the first 16 bytes of SHA-256 of `remote-harness pairing id`, a zero byte and the secret. The daemon SHALL keep its codes in memory only, accept each one for one successful pairing within 5 minutes of its creation and then forget it; an unknown, used or expired code, or a wrong secret, MUST close the connection with 4005, and an 11th device with 4006. A pairing SHALL also need the code's **confirmation code** (ADR-0009), which never travels in the link: when a device announces a live code (mode `0x03`) the daemon SHALL create its confirmation code once (6 digits from a uniform random draw), show it where that code was shown and close the announce with 4011; a pairing (mode `0x04`) before any announce SHALL be handled as an announce. A pairing with a wrong confirmation code MUST close with 4012 and count as an attempt; the third wrong attempt MUST burn the pairing code, close with 4013 and log a warning. The confirmation code expires with its pairing code. `remote-harness pair`, the setup and the tray SHALL ask the running daemon for a code (the tray reuses its current code while more than a minute is left), and `pair` SHALL say that the daemon must be running when it is not. After printing the code, `pair` and the setup SHALL keep running and print the confirmation code when a device announces it ("A device is pairing: enter 123 456 on it"), then that the device paired, that the code was burned by wrong attempts or that it expired, reading the code's state from a local admin route that only the hooks secret opens; Ctrl+C SHALL stop waiting. The token, `rotate-token` and `POST /admin/reload-token` SHALL no longer exist.

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

#### Scenario: Link alone
- **WHEN** someone with a leaked link pairs without the confirmation code shown on the computer
- **THEN** the announce shows the code on the owner's screen and every pairing with another code fails with 4012

#### Scenario: Link and the code on the computer
- **WHEN** the owner's phone announces the code, the terminal running `remote-harness pair` prints "enter 123 456", and the phone pairs with 123456
- **THEN** the daemon records the device, answers `auth.ok`, and the terminal prints that the device paired

#### Scenario: Three wrong codes
- **WHEN** a device pairs three times with a wrong confirmation code
- **THEN** the third attempt closes with 4013, the daemon logs a warning, and the right code no longer pairs (4005)

### Requirement: Pairing code for another device
A paired device SHALL be able to send `pairing.create` and receive `pairing.code` with a fresh single-use pairing code (its link, expiry and ID), the same as `remote-harness pair` prints, so a second device can be added from the first. That connection, and no other, SHALL then receive `pairing.progress` for that code: `presented` with the confirmation code when a device announces it, `paired` when the device pairs, and `locked` when wrong attempts burn it.

#### Scenario: Add a device from the phone
- **WHEN** a paired phone sends `pairing.create`
- **THEN** it receives a `remoteharness://pair?v=2&…` link that pairs one new device within 5 minutes

#### Scenario: Confirmation code on the phone
- **WHEN** a tablet announces a code a paired phone created
- **THEN** only that phone receives `pairing.progress` `presented` with the six digits
