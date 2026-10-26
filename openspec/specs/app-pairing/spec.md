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
Each paired computer's daemon ID, static key, addresses, relays and alias, and this device's key pair for it, MUST be stored only in SecureStore (one item per computer and an index), readable after the first unlock and never leaving this device (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Later connections SHALL use Noise IK with those keys. The single computer saved by the previous version SHALL move into the list on the first start.

#### Scenario: Reopening the app
- **WHEN** the app is closed and opened
- **THEN** it reconnects to the active computer with IK using the saved keys

#### Scenario: Update from one computer
- **WHEN** the app starts with the single computer item of the previous version
- **THEN** that computer is in the list, active, and the old item is gone

### Requirement: Forget daemon
The Machine card and Settings → Computers SHALL allow forgetting a computer after a confirmation: its keys and alias are erased, its connection closes if it was active, and the app switches to another computer or, when none is left, shows the pairing screen.

#### Scenario: Forget
- **WHEN** the user confirms forgetting the only computer
- **THEN** its keys are erased, the connection closes and the pairing screen appears

### Requirement: Pairing code scan
The app SHALL read the pairing code shown by `remote-harness pair`, the setup, the tray or another device's "Add device" (`remoteharness://pair?v=2&…`, also when opened as a deep link), generate this device's X25519 key pair, pair with Noise XXpsk3 over the code's direct addresses and, when none answers, over its relay, check that the daemon's static key is the one in the code and, on `auth.ok`, add the computer, make it active and open the session list. It SHALL register both the `remoteharness://` and the `claude-remote://` deep-link schemes. A code the daemon refuses (used, expired, or the device limit reached) MUST save nothing and show why.

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

#### Scenario: Pairing away from home
- **WHEN** none of the code's direct addresses answers and the code names a relay
- **THEN** the app pairs through that relay

### Requirement: Pair again after the protocol change
Credentials saved by a version before protocol 2 (a host, port and token) SHALL be discarded at start, and the pairing screen SHALL say that this computer must be paired again with a new code.

#### Scenario: Update from a token pairing
- **WHEN** the app starts with credentials that carry a token
- **THEN** it deletes them and shows the pairing screen with the pair-again notice

### Requirement: Try the demo
While no computer is paired, the pairing screen SHALL offer **Try the demo**, which opens the in-app offline demo (see `demo-mode`) without pairing anything. With at least one paired computer (pairing another one from Settings) the action SHALL NOT be shown.

#### Scenario: First launch
- **WHEN** the app opens for the first time
- **THEN** the pairing screen shows **Try the demo** next to the setup guide

#### Scenario: Adding a second computer
- **WHEN** the user opens the pairing screen from Settings → Computers → Add
- **THEN** **Try the demo** is not shown
