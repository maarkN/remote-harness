## MODIFIED Requirements

### Requirement: Pair a phone from the tray
Once the daemon listens for the app, the tray's "Pair a phone" SHALL be a submenu with: on macOS, the pairing QR code (the same link `remote-harness pair` shows); the `host:port` of the daemon; once a device announced that code, its confirmation code ("On the phone, enter 123 456"), refreshed when it appears, also in the Preferences window's Pairing tab; "Show the pairing in the terminal"; and "Rotate token…", whose nested confirmation rotates the token and closes every app connection, so paired phones must pair again. Before the daemon listens, "Pair a phone…" SHALL keep opening the pairing in the terminal. All labels MUST be translated.

#### Scenario: QR in the menu bar
- **WHEN** the user opens Pair a phone on a Mac whose daemon listens on `100.64.0.2:7337`
- **THEN** the submenu shows the QR code of `claude-remote://pair?host=100.64.0.2&port=7337&token=…` and the line `100.64.0.2:7337`

#### Scenario: Rotate the token
- **WHEN** the user confirms "Rotate and sign out the paired phones"
- **THEN** a new token is stored, the app connections close, and the QR shows the new token

#### Scenario: Confirmation code in the tray
- **WHEN** a phone scans the tray's QR and announces it
- **THEN** the submenu and the Pairing tab show "On the phone, enter" with the six digits
