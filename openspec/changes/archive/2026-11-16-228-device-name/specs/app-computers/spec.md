## MODIFIED Requirements

### Requirement: Devices settings
Settings → Devices SHALL list the devices paired with the active computer (name, platform, last seen, this device marked), offer "Add device", which asks for `pairing.create` and shows the code as a QR and a link with its expiry, "Rename" on each device (this one and the others), which opens a sheet with the current name to edit and sends `devices.rename`, and "Revoke" on each device after a confirmation. When this device is revoked (close code 4007), the app SHALL forget that computer and say so.

#### Scenario: Add a tablet from the phone
- **WHEN** the user taps "Add device" on the phone and scans the QR with the tablet
- **THEN** the tablet pairs and appears in the phone's list

#### Scenario: Revoked elsewhere
- **WHEN** the tablet is revoked from the phone
- **THEN** the tablet forgets that computer and shows that it was removed

#### Scenario: Rename the tablet
- **WHEN** the user renames the tablet's row to "Kitchen iPad" from the phone
- **THEN** the list shows "Kitchen iPad" at once and the computer's `devices list` too
