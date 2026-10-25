# app-pairing Specification

## Purpose
Links the app to a specific daemon securely, reading the address and token from a QR code or manual entry.

## Requirements

### Requirement: Manual entry
The app SHALL accept a pasted pairing link (the one `remote-harness pair` prints) with the same pairing, for simulators and phones without a camera.

#### Scenario: No camera
- **WHEN** the user denies camera permission
- **THEN** a field to paste the pairing link is offered

### Requirement: Secure storage
The device key pair and the computer's static key, daemon ID, addresses and machine name MUST be stored only in SecureStore, readable after the first unlock and never leaving this device (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Later connections SHALL use Noise IK with those keys.

#### Scenario: Reopening the app
- **WHEN** the app is closed and opened
- **THEN** it reconnects with IK using the saved keys

### Requirement: Forget daemon
The settings screen SHALL allow erasing the credentials and returning to pairing through `Forget this machine` in the Machine card, after a confirmation.

#### Scenario: Forget
- **WHEN** the user confirms "Forget this machine"
- **THEN** the credentials are erased, the connection closes and the pairing screen appears

### Requirement: Pairing code scan
The app SHALL read the pairing code shown by `remote-harness pair`, the setup or the tray (`remoteharness://pair?v=2&…`, also when opened as a deep link), generate this device's X25519 key pair, pair with Noise XXpsk3 over one of the code's addresses, check that the daemon's static key is the one in the code and, on `auth.ok`, save the computer and open the session list. It SHALL register both the `remoteharness://` and the `claude-remote://` deep-link schemes. A code the daemon refuses (used, expired, or the device limit reached) MUST save nothing and show why.

#### Scenario: Valid QR
- **WHEN** the user points the camera at a fresh pairing code
- **THEN** the app pairs, saves the computer and shows the session list

#### Scenario: QR in another format
- **WHEN** the QR is not a `remoteharness://pair` or `claude-remote://pair` URL with `v=2`
- **THEN** the app shows "Invalid QR" and keeps scanning

#### Scenario: Code already used
- **WHEN** the daemon closes the pairing with 4005
- **THEN** nothing is saved and the app says the code was already used or expired and to show a new one

#### Scenario: Wrong daemon key
- **WHEN** the daemon that answers presents a static key other than the code's
- **THEN** the app drops the connection and saves nothing

### Requirement: Pair again after the protocol change
Credentials saved by a version before protocol 2 (a host, port and token) SHALL be discarded at start, and the pairing screen SHALL say that this computer must be paired again with a new code.

#### Scenario: Update from a token pairing
- **WHEN** the app starts with credentials that carry a token
- **THEN** it deletes them and shows the pairing screen with the pair-again notice
