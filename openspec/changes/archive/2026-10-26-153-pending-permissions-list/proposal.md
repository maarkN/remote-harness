## Why

After the app restarts, a session can stay `waiting` while its pending permission request is gone from the "Waiting for you" strip, the row badge and the session screen (#384). The daemon replays pending requests only once, right after it accepts a connection. The app can miss that replay in two ways:

- The connection authenticates (fast on a local daemon) before the main layout binds the permission store, so nobody is listening when the replay arrives.
- The replay arrives in the same frame batch as `auth.ok`, so it is handled before the ready callback, and the ready callback clears the pending list it had just filled.

## What Changes

- Protocol: `permissions.list` (client) answered with `permissions.result { requests }`, every request waiting now.
- Daemon: handles `permissions.list` from the broker's pending list; the replay on connect stays for older apps.
- App: `bindPermissions` no longer clears the list on ready. On ready, and when bound to a connection that is already open, it asks for `permissions.list` and replaces the pending list with the reply. Requests seen again do not repeat the new-request haptic. With an older daemon (no `permissions.list`), a reconnect keeps only the requests that connection replayed.
- Tests for the ordering (replay before ready, stores bound after the connection opened, reconnect, older daemons) and for the new messages.

## Capabilities

### New Capabilities

### Modified Capabilities

- `permission-approval`: pending requests reach the app after a cold start and after any reconnect, whatever the order of the replay, the ready signal and the store bindings.

## Impact

- Protocol: `packages/protocol/src/{client,server}.ts` (additive; protocol version unchanged).
- Daemon: `features/permissions/index.ts`, `test/permissions.test.ts`.
- App: `features/permissions/store.ts` and its new test.
