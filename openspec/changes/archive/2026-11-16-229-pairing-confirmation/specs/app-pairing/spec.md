## MODIFIED Requirements

### Requirement: Pairing code scan
The app SHALL read the pairing code shown by `remote-harness pair`, the setup, the tray or another device's "Add device" (`remoteharness://pair?v=2&…`, also when opened as a deep link), generate this device's X25519 key pair, announce the code over its direct addresses and, when none answers, over its relay, then show a step asking for the confirmation code the computer now shows ("Enter the code shown on <computer>", a six-digit field, Pair and Cancel) and pair with Noise XXpsk3 and that code over the address or relay that answered the announce, check that the daemon's static key is the one in the code and, on `auth.ok`, add the computer, make it active and open the session list. It SHALL register both the `remoteharness://` and the `claude-remote://` deep-link schemes. A code the daemon refuses (used, expired, or the device limit reached) MUST save nothing and show why. A wrong confirmation code (4012) SHALL keep the step open with an error to try again; a code burned by wrong attempts (4013) SHALL go back to scanning and say a new pairing code is needed; a computer that does not know the announce (4002) SHALL be told to update Remote Harness on the computer.

#### Scenario: Valid QR
- **WHEN** the user points the camera at a fresh pairing code
- **THEN** the app asks for the confirmation code the computer shows, pairs with it, saves the computer and shows the session list

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

#### Scenario: Wrong confirmation code
- **WHEN** the user types digits other than the ones the computer shows
- **THEN** the daemon closes with 4012, nothing is saved, and the step says the code does not match and lets the user type it again

#### Scenario: Older computer
- **WHEN** the computer's daemon does not know the announce and closes it with 4002
- **THEN** nothing is saved and the app says to update Remote Harness on the computer
