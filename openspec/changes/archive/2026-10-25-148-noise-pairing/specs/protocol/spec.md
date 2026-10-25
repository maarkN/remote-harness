## MODIFIED Requirements

### Requirement: Protocol version
The protocol version SHALL be 2. The connection preface carries the preface version and the device's `auth` (its first message in the encrypted channel, without any token) SHALL include `protocolVersion`; the daemon MUST close a connection whose preface version it does not speak with 4002, and answer an `auth` with a different major with a `protocol_mismatch` error and close the connection.

#### Scenario: Incompatible version
- **WHEN** the app sends `protocolVersion` 3 and the daemon speaks version 2
- **THEN** the daemon responds with `error` `protocol_mismatch` and closes the connection

#### Scenario: Auth without token
- **WHEN** a client sends `{"type":"auth","id":"1","protocolVersion":2}`
- **THEN** the message is accepted by the parser
