## Purpose

Several paired computers in one app, how the app reaches the active one (direct or through the connection relay) and how the user manages computers and the devices paired with them.

## ADDED Requirements

### Requirement: Computer list
The app SHALL keep every paired computer (daemon ID, daemon key, this device's key pair for it, direct addresses, home relay, relay list and alias) and which one is active, with one connection at a time to the active computer. Pairing a new computer SHALL add it and make it active; pairing a computer that is already in the list (same daemon ID) SHALL replace its entry.

#### Scenario: Second computer
- **WHEN** the user pairs a desktop while a laptop is already paired
- **THEN** both are listed, the desktop is active and the laptop keeps its keys

### Requirement: Computer switcher
The machine line at the top of the session list SHALL open a switcher with the paired computers (name, active one marked) and "Add a computer" (the pairing screen); picking a computer SHALL close the current connection and connect to it, and the session list SHALL show only that computer's sessions.

#### Scenario: Switch
- **WHEN** the user picks the desktop in the switcher
- **THEN** the app disconnects from the laptop, connects to the desktop and lists the desktop's sessions

### Requirement: Path selection
For the active computer the app SHALL try its direct addresses first (a short timeout each), then its home relay and then the other relays in its list, by daemon ID; a relay that answers 4004 SHALL be followed by the next relay. While connected through a relay it SHALL probe the direct addresses every 30 s and when the app returns to the foreground, and move to a direct connection that completes the handshake and `auth`, re-subscribing from the last cursors so no conversation state is lost. `daemon.paths` SHALL update the saved addresses, home relay and relay list. The connection state SHALL show whether the direct path or the relay is in use.

#### Scenario: Away from home
- **WHEN** no direct address answers
- **THEN** the app connects through the home relay and shows "via relay"

#### Scenario: Back home
- **WHEN** the app is on the relay and a direct address answers the probe
- **THEN** it moves to the direct connection and the open conversation keeps its entries

#### Scenario: Home relay moved
- **WHEN** the saved home relay answers 4004 for the daemon
- **THEN** the app tries the other relays and connects where the daemon is

### Requirement: Devices settings
Settings → Devices SHALL list the devices paired with the active computer (name, platform, last seen, this device marked), offer "Add device", which asks for `pairing.create` and shows the code as a QR and a link with its expiry, and "Revoke" on each device after a confirmation. When this device is revoked (close code 4007), the app SHALL forget that computer and say so.

#### Scenario: Add a tablet from the phone
- **WHEN** the user taps "Add device" on the phone and scans the QR with the tablet
- **THEN** the tablet pairs and appears in the phone's list

#### Scenario: Revoked elsewhere
- **WHEN** the tablet is revoked from the phone
- **THEN** the tablet forgets that computer and shows that it was removed

### Requirement: Computers settings
Settings → Computers SHALL list the paired computers with their name and the active one marked, rename one (an alias kept on this device) and forget one after a confirmation, which deletes its keys and alias and, for the active computer, its drafts; forgetting the last computer SHALL open the pairing screen.

#### Scenario: Forget the laptop
- **WHEN** the user forgets the laptop while the desktop is active
- **THEN** the laptop disappears and the desktop stays connected
