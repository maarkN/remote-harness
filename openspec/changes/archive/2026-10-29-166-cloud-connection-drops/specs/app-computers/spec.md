## MODIFIED Requirements

### Requirement: Path selection
For the active computer the app SHALL try its direct addresses first (a short timeout each), then its home relay and then the other relays in its list, by daemon ID, except that after a connection drops it SHALL start with the address or relay that last completed `auth` and then try the others in that order; a relay that answers 4004 SHALL be followed by the next relay. While connected through a relay it SHALL probe the direct addresses every 30 s and when the app returns to the foreground, and move to a direct connection that completes the handshake and `auth`, re-subscribing from the last cursors so no conversation state is lost. `daemon.paths` SHALL update the saved addresses, home relay and relay list. The connection state SHALL show whether the direct path or the relay is in use. While connected, when nothing has been received for 30 s the app SHALL send `ping`; when no reply arrives within 10 s it SHALL drop that connection at once (without waiting for a close handshake), fail its pending requests as disconnected and reconnect, without reporting the heartbeat as a request error.

#### Scenario: Away from home
- **WHEN** no direct address answers
- **THEN** the app connects through the home relay and shows "via relay"

#### Scenario: Back home
- **WHEN** the app is on the relay and a direct address answers the probe
- **THEN** it moves to the direct connection and the open conversation keeps its entries

#### Scenario: Home relay moved
- **WHEN** the saved home relay answers 4004 for the daemon
- **THEN** the app tries the other relays and connects where the daemon is

#### Scenario: Quiet session on the relay
- **WHEN** the app is connected through the relay and no message arrives for 30 s
- **THEN** it sends `ping`, the `pong` crosses the channel, and the relay does not close the channel as idle after 10 minutes

#### Scenario: Half-open connection
- **WHEN** a NAT drops the connection silently and the `ping` gets no reply within 10 s
- **THEN** the app closes that socket and reconnects without waiting for the operating system

#### Scenario: Reconnect away from home
- **WHEN** the app was connected through the relay and the connection drops
- **THEN** the next attempt goes to that relay first instead of waiting on each direct address
