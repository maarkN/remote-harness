## MODIFIED Requirements

### Requirement: On-device error log
The app SHALL record JS crashes, unhandled promise rejections, render errors, failed daemon requests (error replies other than `unknown_type`, and timeouts) and daemon messages that fail validation against the protocol schemas (source `message`, with the message type and the parse code `bad_request` or `unknown_type`; also warned in the console in development builds) in a rotating log on the device with at most 50 entries. Recording MUST NOT send anything off the device. Each entry MUST contain only the allowlisted fields: time, source, error name, scrubbed message, scrubbed stack, request type, error code, route pattern and the app context (app version, runtime version, OTA update id and channel, platform, OS version, daemon version). Request errors MUST NOT carry the daemon's message.

#### Scenario: Failed request
- **WHEN** a `session.start` request is answered with `error` `invalid_cwd` and message "not a directory: /Users/me/secret"
- **THEN** the log gains an entry with source `request`, type `session.start` and code `invalid_cwd`, and without the message

#### Scenario: Rotation
- **WHEN** the log has 50 entries and another error happens
- **THEN** the oldest entry is dropped

#### Scenario: Daemon message that does not validate
- **WHEN** the daemon sends a `session.changed` whose `sessionId` is a number
- **THEN** the log gains an entry with source `message`, type `session.changed` and code `bad_request`, and the connection stays open
