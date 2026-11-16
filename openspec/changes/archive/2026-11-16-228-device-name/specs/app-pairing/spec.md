## MODIFIED Requirements

### Requirement: Pairing code scan
The app SHALL read the pairing code shown by `remote-harness pair`, the setup, the tray or another device's "Add device" (`remoteharness://pair?v=2&…`, also when opened as a deep link), generate this device's X25519 key pair, pair with Noise XXpsk3 over the code's direct addresses and, when none answers, over its relay, check that the daemon's static key is the one in the code and, on `auth.ok`, add the computer, make it active and ask for this device's name before opening the session list: a screen with the name prefilled (the user-assigned device name when the system gives one other than just "iPhone" or "iPad", else the model, such as "iPhone 15 Pro" or "Pixel 8", else the platform default), **Save**, which sends `devices.rename` once the connection is open, and **Skip**, which keeps the platform default the pairing sent. A failed rename SHALL say so and let the user try again or skip. It SHALL register both the `remoteharness://` and the `claude-remote://` deep-link schemes. A code the daemon refuses (used, expired, or the device limit reached) MUST save nothing and show why.

#### Scenario: Valid QR
- **WHEN** the user points the camera at a fresh pairing code
- **THEN** the app pairs, saves the computer, asks for this device's name and then shows the session list

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

#### Scenario: Name after pairing
- **WHEN** the pairing succeeds on an iPhone 15 Pro whose system name is just "iPhone"
- **THEN** the app shows the name step prefilled with "iPhone 15 Pro", and Save stores that name on the computer before the session list opens

#### Scenario: Skip the name
- **WHEN** the user taps Skip on the name step
- **THEN** the session list opens and the computer keeps the platform default name
