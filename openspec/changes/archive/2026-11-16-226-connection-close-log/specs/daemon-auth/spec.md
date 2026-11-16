## ADDED Requirements

### Requirement: Connection log
The daemon SHALL log one `info` line, `connection closed`, for every device connection that ends, on the direct path and on the relay path, with the connection's id and path, the device id once the handshake identified it, the close code and reason, who closed it (`daemon` or `device`) and either how long it stayed open after `auth.ok` in milliseconds or, for a connection that never reached `auth.ok`, the stage it ended in (`handshake` or `auth`). On the relay path the close code SHALL be the one in the connection relay's CLOSE frame (the device's own code, or the relay's: idle, too slow, message too large, each with a short reason), and a relay connection that ends SHALL close its channels with the reason "relay connection lost". A direct connection that does not answer the daemon's WebSocket ping before the next one SHALL be terminated and logged as closed by the daemon with code 1006 and the reason "no pong (dead connection)". The line MUST NOT carry session content.

#### Scenario: Phone leaves after an hour
- **WHEN** a paired phone authenticates on the direct path and closes its connection with 1000 an hour later
- **THEN** the log has `connection closed` with path `direct`, code 1000, closed by `device` and an `openMs` of about 3,600,000

#### Scenario: Closed during the handshake
- **WHEN** a device opens a connection, sends its first handshake message and goes away before the handshake completes
- **THEN** the log has `connection closed` with `closedDuring: handshake` and no `openMs`

#### Scenario: Dead connection
- **WHEN** an authenticated phone stops answering the daemon's pings on the direct path
- **THEN** the daemon terminates the connection and logs `connection closed` with code 1006, reason "no pong (dead connection)" and closed by `daemon`

#### Scenario: Idle channel on the relay
- **WHEN** the connection relay closes a device's channel as idle and sends its CLOSE frame with 4010
- **THEN** the log has `connection closed` with path `relay`, code 4010 and reason "idle on the relay"
