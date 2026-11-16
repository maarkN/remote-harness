## MODIFIED Requirements

### Requirement: Devices settings
Settings → Devices SHALL list the devices paired with the active computer (name, platform, last seen, this device marked), offer "Add device", which asks for `pairing.create` and shows the code as a QR and a link with its expiry and then, from `pairing.progress`, the confirmation code to type on the other device once it scans the QR, that it paired (refreshing the list) or that wrong codes burned the QR, and "Revoke" on each device after a confirmation. When this device is revoked (close code 4007), the app SHALL forget that computer and say so.

#### Scenario: Add a tablet from the phone
- **WHEN** the user taps "Add device" on the phone and scans the QR with the tablet
- **THEN** the tablet pairs and appears in the phone's list

#### Scenario: Revoked elsewhere
- **WHEN** the tablet is revoked from the phone
- **THEN** the tablet forgets that computer and shows that it was removed

#### Scenario: Code for the tablet
- **WHEN** the tablet scans the QR shown on the phone
- **THEN** the phone's sheet shows "A device is pairing: enter this code on it" with the six digits, and once the tablet pairs the sheet says so and the list shows the tablet
