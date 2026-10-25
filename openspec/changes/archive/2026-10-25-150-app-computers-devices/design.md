## Context

After #364/#365 the app keeps one computer (`remote-harness.computer`) and `DaemonClient` dials `ws://` direct addresses in turn; the daemon serves the relay path, `daemon.paths`, `devices.*` and `pairing.create`.

## Decisions

- **Storage**: one SecureStore item per computer (`remote-harness.computer.<daemonId>`) and an index (`remote-harness.computers`: ids and the active one). SecureStore values can be small on Android, so the list never lives in one value. The #364 single item is migrated once.
- **Path plan as a pure function**: `connectionTargets(computer)` lists direct URLs then relay URLs (home first, then the rest of `relays`, deduplicated); each attempt takes the next target, the first pass through the targets without backoff, with a 3 s connect timeout for direct targets and 10 s for relays. Close code 4004 from a relay is not final.
- **Moving back to direct** without disturbing the stores: a probe opens a second socket to a direct address and runs IK + `auth` on it; on `auth.ok` the client swaps sockets and sessions and fires `onReady`, which every store already handles (resubscribe from cursors). A probe is skipped while requests are pending.
- **Several computers, one client**: the connection store keeps `computers`, `activeId` and the client of the active one; switching closes the client, clears the per-computer stores (sessions, transcripts, permissions) through the existing `setCredentials` flow and opens the next. Push tokens are registered with each computer whenever it is active, so all of them keep sending.
- **Notifications** name their computer: the daemon adds `daemonId` to push data and `?computer=` to the live status link; taps on another computer's notification switch first, background answers dial that computer.
- **QR in the app** with `uqr` (pure JS, already used by the website) drawn with `react-native-svg`.

## Risks / Trade-offs

- A probe costs one extra handshake every 30 s on the relay path → only while on the relay, and only when the computer has direct addresses.
- Drafts are keyed by session, not computer → forgetting the active computer clears the drafts of its listed sessions; an inactive one's drafts stay until they expire (7 days).
