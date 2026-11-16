## MODIFIED Requirements

### Requirement: Protocol version
The protocol version SHALL be 2. The connection preface carries the preface version and the device's `auth` (its first message in the encrypted channel, without any token) SHALL include `protocolVersion` and MAY include `app { version, runtime?, update? }` (the app version, the runtime version of its native build and the OTA update id it runs, at most 32, 64 and 64 characters); an `app` that does not validate SHALL be dropped and the `auth` accepted without it; the daemon MUST close a connection whose preface version it does not speak with 4002, and answer an `auth` with a different major with a `protocol_mismatch` error and close the connection.

#### Scenario: Incompatible version
- **WHEN** the app sends `protocolVersion` 3 and the daemon speaks version 2
- **THEN** the daemon responds with `error` `protocol_mismatch` and closes the connection

#### Scenario: Auth without token
- **WHEN** a client sends `{"type":"auth","id":"1","protocolVersion":2}`
- **THEN** the message is accepted by the parser

#### Scenario: Auth with the app build
- **WHEN** a client sends `{"type":"auth","id":"1","protocolVersion":2,"app":{"version":"1.2.2","runtime":"a1b2c3"}}`
- **THEN** the parser accepts it with that `app`

#### Scenario: Malformed app build
- **WHEN** a client sends `auth` with `"app":{"version":42}`
- **THEN** the parser accepts the `auth` without `app`

### Requirement: Paths, devices and lean traffic messages
The protocol SHALL define the client messages `devices.list`, `devices.revoke { deviceId }` and `pairing.create`, and the server messages `devices.result { devices }` (each `{ id, name, platform, pairedAt, lastSeen, current, app? }`, times as ISO strings, `lastSeen` nullable, `app` the last app build the device authenticated with, absent until it sends one), `pairing.code { url, expiresAt }`, `daemon.paths { addresses, relay, relays }` (also carried by `auth.ok` as `paths`), `transcript.entries { sessionId, agentId?, entries }`, `pane.diff { sessionId, cols, rows, lineCount, scroll?, lines }` and `session.changed { sessionId, set, unset }`. `transcript.entries` replaces `transcript.entry`. The channel close codes SHALL include 4007 (device revoked), which the app treats as final.

#### Scenario: Revoke message
- **WHEN** a client sends `devices.revoke` without `deviceId`
- **THEN** the parser rejects it with `bad_request`

#### Scenario: Session delta
- **WHEN** the daemon sends `{"type":"session.changed","sessionId":"s","set":{"state":"running"},"unset":[]}`
- **THEN** the app's parser accepts it

### Requirement: Daemon diagnostics
The daemon SHALL log every rejected WS request with its message type and error code and without its payload or message, keep the last 50 rejections in memory as `{ at, type, code }`, and answer `diagnostics.errors` with `diagnostics.result { daemonVersion, errors, devices }`, errors most recent first, `devices` each paired device's `{ id, platform, lastSeen, current, app? }` without its name. It SHALL answer `diagnostics.logs` with `diagnostics.logs.result { files }`, one `{ name, text, truncated }` per log file present, scrubbed as error-reports "Computer logs" says.

#### Scenario: Recent rejections
- **WHEN** a `session.start` was rejected with `invalid_cwd` and the app sends `diagnostics.errors`
- **THEN** the reply lists `{ type: "session.start", code: "invalid_cwd" }` with its time, and no path

#### Scenario: Older daemon
- **WHEN** the daemon does not know `diagnostics.errors`
- **THEN** it answers `unknown_type` and the app hides the option to include the computer's errors

#### Scenario: Logs
- **WHEN** the app sends `diagnostics.logs` and the daemon has `daemon.log` and `update.log`
- **THEN** it answers `diagnostics.logs.result` with those two files, scrubbed

#### Scenario: Devices in the diagnostics
- **WHEN** a phone that authenticated with app 1.2.2 sends `diagnostics.errors`
- **THEN** the reply's `devices` has its ID with `current: true` and `app.version` "1.2.2", and no device name
