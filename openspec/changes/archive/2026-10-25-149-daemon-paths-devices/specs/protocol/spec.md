## ADDED Requirements

### Requirement: Paths, devices and lean traffic messages
The protocol SHALL define the client messages `devices.list`, `devices.revoke { deviceId }` and `pairing.create`, and the server messages `devices.result { devices }` (each `{ id, name, platform, pairedAt, lastSeen, current }`, times as ISO strings, `lastSeen` nullable), `pairing.code { url, expiresAt }`, `daemon.paths { addresses, relay, relays }` (also carried by `auth.ok` as `paths`), `transcript.entries { sessionId, agentId?, entries }`, `pane.diff { sessionId, cols, rows, lineCount, scroll?, lines }` and `session.changed { sessionId, set, unset }`. `transcript.entries` replaces `transcript.entry`. The channel close codes SHALL include 4007 (device revoked), which the app treats as final.

#### Scenario: Revoke message
- **WHEN** a client sends `devices.revoke` without `deviceId`
- **THEN** the parser rejects it with `bad_request`

#### Scenario: Session delta
- **WHEN** the daemon sends `{"type":"session.changed","sessionId":"s","set":{"state":"running"},"unset":[]}`
- **THEN** the app's parser accepts it
