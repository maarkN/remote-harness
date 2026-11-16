# daemon-auth Specification

## Purpose
Ensures that only the paired device controls the sessions, since the daemon is equivalent to a remote shell.

## Requirements

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

### Requirement: Paired devices
The daemon SHALL keep each paired device's static public key, a short ID derived from it, its name, platform, pairing time, last connection time and the last app build it authenticated with (`auth.app`, kept when a later `auth` has none) in `~/.remote-harness/paired-devices.json`, at most 10 devices, and accept a reconnecting device only when its static key is in that list. `devices.list` SHALL answer `devices.result` with each device's ID, name, platform, `pairedAt`, `lastSeen`, whether it is the asking device and its last app build; `devices.rename` SHALL store a device's new name and answer `devices.result` with the updated list, or `not_found` for an unknown ID, the tray's device list following at once; `devices.revoke` SHALL remove a device, close its open connections with 4007 and refuse its key from then on; `remote-harness devices list` and `remote-harness devices revoke <id>` SHALL do the same from the computer, the list showing each device's last app version ("?" when unknown). The daemon's `client authenticated` log line SHALL carry the app version, runtime and update the device sent.

#### Scenario: Restart
- **WHEN** the daemon restarts
- **THEN** devices paired before reconnect with IK without pairing again

#### Scenario: Revoke from another device
- **WHEN** a phone revokes the tablet's device ID while the tablet is connected
- **THEN** the tablet's connection is closed with 4007 and its next IK is refused with 4001

#### Scenario: List from the CLI
- **WHEN** the user runs `remote-harness devices list`
- **THEN** each paired device is printed with its ID, name, platform, paired and last seen times and its last app version

#### Scenario: App build of each phone
- **WHEN** a phone running app 1.2.2 with OTA update `0199f2d4-…` authenticates
- **THEN** the log line `client authenticated` carries that version, runtime and update, and `paired-devices.json` keeps them for that device

#### Scenario: Older app
- **WHEN** a phone whose app does not send `app` authenticates
- **THEN** it is accepted, its last known app build stays as it was, and `devices list` shows "app ?" if none was ever seen

#### Scenario: Rename from the phone
- **WHEN** a paired phone sends `devices.rename` with its own ID and the name "Hanna's iPhone"
- **THEN** the daemon saves it, answers the updated list with that name, and `remote-harness devices list` and the tray show "Hanna's iPhone"

#### Scenario: Unknown device
- **WHEN** a phone sends `devices.rename` with an ID no device has
- **THEN** the daemon answers `error` `not_found` and changes nothing

### Requirement: Key storage
The daemon's identity — its Noise static key pair and its Ed25519 connection relay key pair, whose daemon ID is the first 16 bytes of SHA-256 of the relay public key in hex — SHALL be created at first start and stored in the secret store (macOS Keychain, Linux Secret Service, or a 0600 file where neither exists), never in plain text elsewhere. `remote-harness doctor` SHALL report whether the identity exists.

#### Scenario: Persisted identity
- **WHEN** the daemon restarts
- **THEN** it has the same static key and daemon ID, so paired devices keep working

### Requirement: Listening for devices
The device WebSocket SHALL listen on all interfaces (or only on `127.0.0.1` in explicit development mode, or on the `--host` address), and every connection on it MUST complete the Noise channel with a paired key before receiving anything; with `direct: "off"` it SHALL not listen at all. The hooks endpoint MUST listen only on `127.0.0.1` and require the local secret.

#### Scenario: Stranger on the network
- **WHEN** a host on the same network opens the daemon's port and sends anything but a valid handshake from a paired device
- **THEN** the connection is closed without any protocol message

#### Scenario: Hook without secret
- **WHEN** a request reaches the hooks endpoint without the secret
- **THEN** it responds 401 and does not process the event

### Requirement: Pairing code for another device
A paired device SHALL be able to send `pairing.create` and receive `pairing.code` with a fresh single-use pairing code (its link, expiry and ID), the same as `remote-harness pair` prints, so a second device can be added from the first. That connection, and no other, SHALL then receive `pairing.progress` for that code: `presented` with the confirmation code when a device announces it, `paired` when the device pairs, and `locked` when wrong attempts burn it.

#### Scenario: Add a device from the phone
- **WHEN** a paired phone sends `pairing.create`
- **THEN** it receives a `remoteharness://pair?v=2&…` link that pairs one new device within 5 minutes

#### Scenario: Confirmation code on the phone
- **WHEN** a tablet announces a code a paired phone created
- **THEN** only that phone receives `pairing.progress` `presented` with the six digits

### Requirement: Connection log
The daemon SHALL log one `info` line, `connection closed`, for every device connection that ends, on the direct path and on the relay path, with the connection's id and path, the device id once the handshake identified it, the close code and reason, who closed it (`daemon` or `device`) and either how long it stayed open after `auth.ok` in milliseconds or, for a connection that never reached `auth.ok`, the stage it ended in (`handshake` or `auth`). On the relay path the close code SHALL be the one in the connection relay's CLOSE frame (the device's own code, or the relay's: idle, too slow, message too large, each with a short reason), and a relay connection that ends SHALL close its channels with the reason "relay connection lost". A direct connection that does not answer the daemon's WebSocket ping before the next one SHALL be terminated and logged as closed by the daemon with code 1006 and the reason "no pong (dead connection)". The line MUST NOT carry session content.

#### Scenario: Phone leaves after an hour
- **WHEN** a paired phone authenticates on the direct path and closes its connection with 1000 an hour later
- **THEN** the log has `connection closed` with path `direct`, code 1000, closed by `device` and an `openMs` of about 3,600,000

#### Scenario: Closed during the handshake
- **WHEN** a device opens a connection, sends its first handshake message and goes away before the handshake completes
- **THEN** the log has `connection closed` with `closedDuring: handshake` and no `openMs`

#### Scenario: Dead connection
- **WHEN** an authenticated phone stops answering the daemon's pings on the direct path
- **THEN** the daemon terminates the connection and logs `connection closed` with code 1006, reason "no pong (dead connection)" and closed by `daemon`

#### Scenario: Idle channel on the relay
- **WHEN** the connection relay closes a device's channel as idle and sends its CLOSE frame with 4010
- **THEN** the log has `connection closed` with path `relay`, code 4010 and reason "idle on the relay"
