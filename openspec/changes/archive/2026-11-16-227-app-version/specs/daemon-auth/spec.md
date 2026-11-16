## MODIFIED Requirements

### Requirement: Paired devices
The daemon SHALL keep each paired device's static public key, a short ID derived from it, its name, platform, pairing time, last connection time and the last app build it authenticated with (`auth.app`, kept when a later `auth` has none) in `~/.remote-harness/paired-devices.json`, at most 10 devices, and accept a reconnecting device only when its static key is in that list. `devices.list` SHALL answer `devices.result` with each device's ID, name, platform, `pairedAt`, `lastSeen`, whether it is the asking device and its last app build; `devices.revoke` SHALL remove a device, close its open connections with 4007 and refuse its key from then on; `remote-harness devices list` and `remote-harness devices revoke <id>` SHALL do the same from the computer, the list showing each device's last app version ("?" when unknown). The daemon's `client authenticated` log line SHALL carry the app version, runtime and update the device sent.

#### Scenario: Restart
- **WHEN** the daemon restarts
- **THEN** devices paired before reconnect with IK without pairing again

#### Scenario: Revoke from another device
- **WHEN** a phone revokes the tablet's device ID while the tablet is connected
- **THEN** the tablet's connection is closed with 4007 and its next IK is refused with 4001

#### Scenario: List from the CLI
- **WHEN** the user runs `remote-harness devices list`
- **THEN** each paired device is printed with its ID, name, platform, paired and last seen times and its last app version

#### Scenario: App build of each phone
- **WHEN** a phone running app 1.2.2 with OTA update `0199f2d4-…` authenticates
- **THEN** the log line `client authenticated` carries that version, runtime and update, and `paired-devices.json` keeps them for that device

#### Scenario: Older app
- **WHEN** a phone whose app does not send `app` authenticates
- **THEN** it is accepted, its last known app build stays as it was, and `devices list` shows "app ?" if none was ever seen
