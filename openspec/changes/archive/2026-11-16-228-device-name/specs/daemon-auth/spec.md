## MODIFIED Requirements

### Requirement: Paired devices
The daemon SHALL keep each paired device's static public key, a short ID derived from it, its name, platform, pairing time and last connection time in `~/.remote-harness/paired-devices.json`, at most 10 devices, and accept a reconnecting device only when its static key is in that list. `devices.list` SHALL answer `devices.result` with each device's ID, name, platform, `pairedAt`, `lastSeen` and whether it is the asking device; `devices.rename` SHALL store a device's new name and answer `devices.result` with the updated list, or `not_found` for an unknown ID, the tray's device list following at once; `devices.revoke` SHALL remove a device, close its open connections with 4007 and refuse its key from then on; `remote-harness devices list` and `remote-harness devices revoke <id>` SHALL do the same from the computer.

#### Scenario: Restart
- **WHEN** the daemon restarts
- **THEN** devices paired before reconnect with IK without pairing again

#### Scenario: Revoke from another device
- **WHEN** a phone revokes the tablet's device ID while the tablet is connected
- **THEN** the tablet's connection is closed with 4007 and its next IK is refused with 4001

#### Scenario: List from the CLI
- **WHEN** the user runs `remote-harness devices list`
- **THEN** each paired device is printed with its ID, name, platform, paired and last seen times

#### Scenario: Rename from the phone
- **WHEN** a paired phone sends `devices.rename` with its own ID and the name "Hanna's iPhone"
- **THEN** the daemon saves it, answers the updated list with that name, and `remote-harness devices list` and the tray show "Hanna's iPhone"

#### Scenario: Unknown device
- **WHEN** a phone sends `devices.rename` with an ID no device has
- **THEN** the daemon answers `error` `not_found` and changes nothing
