## MODIFIED Requirements

### Requirement: Paired devices
The daemon SHALL keep each paired device's static public key, a short ID derived from it, its name, platform, pairing time, last connection time and the last app build it authenticated with (`auth.app`, kept when a later `auth` has none) in `~/.remote-harness/paired-devices.json`, at most 10 devices, and accept a reconnecting device only when its static key is in that list. `devices.list` SHALL answer `devices.result` with each device's ID, name, platform, `pairedAt`, `lastSeen`, whether it is the asking device and its last app build; `devices.rename` SHALL store a device's new name and answer `devices.result` with the updated list, or `not_found` for an unknown ID, the tray's device list following at once; `devices.revoke` SHALL remove a device, close its open connections with 4007 and refuse its key from then on; `remote-harness devices list` and `remote-harness devices revoke <id>` SHALL do the same from the computer. `devices list` SHALL print a table: a header row (ID, name, platform, paired, last seen, app, in the CLI's language) and one row per device, with columns padded by display width so names with accents, wide characters or emoji stay aligned, the most recently seen device first (devices never seen last, newest pairing first), and "—" for an unknown name, platform or app version. The daemon's `client authenticated` log line SHALL carry the app version, runtime and update the device sent.

#### Scenario: Restart
- **WHEN** the daemon restarts
- **THEN** devices paired before reconnect with IK without pairing again

#### Scenario: Revoke from another device
- **WHEN** a phone revokes the tablet's device ID while the tablet is connected
- **THEN** the tablet's connection is closed with 4007 and its next IK is refused with 4001

#### Scenario: List from the CLI
- **WHEN** the user runs `remote-harness devices list` with four paired devices, one named "iPhone da Hanna 📱"
- **THEN** a header row and four rows are printed with aligned columns (ID, name, platform, paired, last seen, app), the most recently seen first, the emoji name not shifting the columns after it

#### Scenario: App build of each phone
- **WHEN** a phone running app 1.2.2 with OTA update `0199f2d4-…` authenticates
- **THEN** the log line `client authenticated` carries that version, runtime and update, and `paired-devices.json` keeps them for that device

#### Scenario: Older app
- **WHEN** a phone whose app does not send `app` authenticates
- **THEN** it is accepted, its last known app build stays as it was, and `devices list` shows "—" in its app column if none was ever seen

#### Scenario: Rename from the phone
- **WHEN** a paired phone sends `devices.rename` with its own ID and the name "Hanna's iPhone"
- **THEN** the daemon saves it, answers the updated list with that name, and `remote-harness devices list` and the tray show "Hanna's iPhone"

#### Scenario: Unknown device
- **WHEN** a phone sends `devices.rename` with an ID no device has
- **THEN** the daemon answers `error` `not_found` and changes nothing
