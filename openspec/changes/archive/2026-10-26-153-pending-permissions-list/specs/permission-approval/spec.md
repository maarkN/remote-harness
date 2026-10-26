## ADDED Requirements

### Requirement: Pending requests after a reconnect
The daemon SHALL send every pending request to a client right after it accepts the connection, and SHALL answer `permissions.list` with `permissions.result { requests }` listing every request waiting at that moment. On every ready connection, and when its permission store is bound to a connection that is already open, the app SHALL ask for `permissions.list` and replace its pending requests with the reply, so a cold start or a reconnect shows every waiting request in the "Waiting for you" strip, the row's badge and the session screen, answerable. Whether the replay arrives before the app sees the connection as ready MUST NOT matter, and a request seen again MUST NOT repeat the new-request haptic. With a daemon that has no `permissions.list`, the app SHALL keep, after a reconnect, the requests that connection replayed and drop the others.

#### Scenario: Cold start
- **WHEN** a session waits on a Bash request and the app is relaunched
- **THEN** the strip shows the request with Deny / Always / Allow and the row shows "1 permission"

#### Scenario: Replay before the stores listen
- **WHEN** the connection authenticates and the daemon replays the request before the app binds its permission store
- **THEN** the store, once bound, asks for `permissions.list` and shows the request

#### Scenario: Reconnect after an answer elsewhere
- **WHEN** the app reconnects after one of two pending requests was answered from the tray
- **THEN** only the other request remains, and it does not buzz again
