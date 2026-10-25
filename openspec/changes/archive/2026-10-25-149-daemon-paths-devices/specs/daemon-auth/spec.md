## MODIFIED Requirements

### Requirement: Paired devices
The daemon SHALL keep each paired device's static public key, a short ID derived from it, its name, platform, pairing time and last connection time in `~/.remote-harness/paired-devices.json`, at most 10 devices, and accept a reconnecting device only when its static key is in that list. `devices.list` SHALL answer `devices.result` with each device's ID, name, platform, `pairedAt`, `lastSeen` and whether it is the asking device; `devices.revoke` SHALL remove a device, close its open connections with 4007 and refuse its key from then on; `remote-harness devices list` and `remote-harness devices revoke <id>` SHALL do the same from the computer.

#### Scenario: Restart
- **WHEN** the daemon restarts
- **THEN** devices paired before reconnect with IK without pairing again

#### Scenario: Revoke from another device
- **WHEN** a phone revokes the tablet's device ID while the tablet is connected
- **THEN** the tablet's connection is closed with 4007 and its next IK is refused with 4001

#### Scenario: List from the CLI
- **WHEN** the user runs `remote-harness devices list`
- **THEN** each paired device is printed with its ID, name, platform, paired and last seen times

## ADDED Requirements

### Requirement: Listening for devices
The device WebSocket SHALL listen on all interfaces (or only on `127.0.0.1` in explicit development mode, or on the `--host` address), and every connection on it MUST complete the Noise channel with a paired key before receiving anything; with `direct: "off"` it SHALL not listen at all. The hooks endpoint MUST listen only on `127.0.0.1` and require the local secret.

#### Scenario: Stranger on the network
- **WHEN** a host on the same network opens the daemon's port and sends anything but a valid handshake from a paired device
- **THEN** the connection is closed without any protocol message

#### Scenario: Hook without secret
- **WHEN** a request reaches the hooks endpoint without the secret
- **THEN** it responds 401 and does not process the event

### Requirement: Pairing code for another device
A paired device SHALL be able to send `pairing.create` and receive `pairing.code` with a fresh single-use pairing code (its link and expiry), the same as `remote-harness pair` prints, so a second device can be added from the first.

#### Scenario: Add a device from the phone
- **WHEN** a paired phone sends `pairing.create`
- **THEN** it receives a `remoteharness://pair?v=2&…` link that pairs one new device within 5 minutes

## REMOVED Requirements

### Requirement: Restricted network interface
**Reason**: The daemon no longer depends on Tailscale (ADR-0001): the direct path listens on every interface and the Noise channel with paired keys is the protection.
**Migration**: Replaced by "Listening for devices"; a tailnet address still works as a direct path.
