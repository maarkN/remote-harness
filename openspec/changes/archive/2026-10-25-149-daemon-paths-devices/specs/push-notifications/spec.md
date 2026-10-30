## MODIFIED Requirements

### Requirement: Device registration
The app SHALL request notification permission, obtain the FCM token and send `device.register`; the daemon MUST store only tokens received over authenticated connections, keep at most one registration per paired device (the latest), and drop the registrations of devices that are revoked or no longer paired.

#### Scenario: Token refreshed
- **WHEN** FCM refreshes the token
- **THEN** the app sends the new token and the daemon replaces that device's old one

#### Scenario: Ten devices
- **WHEN** ten paired devices each register their token
- **THEN** all ten receive pushes

#### Scenario: Revoked device
- **WHEN** a device is revoked
- **THEN** its push registration is removed and it receives no further pushes
