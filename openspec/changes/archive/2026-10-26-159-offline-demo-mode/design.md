## Context

The app talks to a daemon only through `DaemonClient` (`apps/mobile/src/core/connection/daemon-client.ts`): a WebSocket, a Noise channel (IK on reconnect) and protocol messages validated with `@remote-harness/protocol`. Feature stores bind to whatever client the connection store holds. `DaemonClientOptions.socketFactory` already lets tests replace the WebSocket. The daemon's screenshot demo (`apps/daemon/scripts/demo.mts`) builds fictional sessions from `demo-data.ts`, but runs a real daemon on `127.0.0.1` and cannot serve a store reviewer.

## Goals / Non-Goals

**Goals:**
- A reviewer reaches every main screen with no computer, no account and no network.
- No screen or store learns about the demo beyond a few gates (push, live status, performance, error reports, Settings cards); the protocol path is the real one.
- One source for the fictional data, shared with the daemon demo.

**Non-Goals:**
- Simulating everything a daemon does (starting/resuming sessions, attachments, shell commands, commit/push/PR, pairing other devices).
- Persisting the demo across restarts.
- Changing the protocol or the daemon at runtime.

## Decisions

- **Demo daemon behind a fake socket, with a real Noise responder.** `DemoSocket` implements `SocketLike`: it opens on the next tick, answers the device's IK message with `DaemonHandshake` (a static key generated for the run, every device key accepted), then decrypts each request, hands it to `DemoDaemon` and seals the replies. The alternative, a "plaintext" mode in `DaemonClient`, would add a code path to security-sensitive code used by real connections; the fake socket keeps `DaemonClient` untouched and makes the Vitest tests exercise the real client end to end (`createNoiseCrypto(node:crypto)`).
- **`DemoDaemon` is pure.** It holds the demo state (sessions, transcripts, pending request, mute, approvals), takes a parsed `ClientMessage` and pushes `ServerMessage`s to a sink; timers come from an injected scheduler, the localized "not available in the demo" text and the fictional reply come from injected labels. Every message it emits is checked by the tests against `ServerMessageSchema`.
- **Fixtures in `@remote-harness/protocol/demo`.** A subpath export (like `./noise-test-vectors`) holds the profiles, repositories, sessions, subagents and the pane renderer, with no Node APIs. `apps/daemon/scripts/demo-data.ts` re-exports them and keeps the file-system parts (layout, transcript lines). The app adapts them to protocol entries (`TranscriptEntry`, `Session`, `PermissionRequestInfo`) under a fictional home, `/Users/demo`.
- **Connection store owns the flag.** `useConnectionStore` gets `demo: boolean` and `enterDemo(computer, socketFactory)`. `connect()` (used by pairing, switching and forgetting) clears the flag, so pairing a real computer ends the demo. Leaving calls `setCredentials(null)` and the demo feature's cleanup (drafts, pins, hidden sessions of the demo ids), and the store resets the computer state as for any computer change. The demo computer is never added to `computers` nor saved.
- **Gates.** `usePush`, `useLiveStatus` and `useLiveFollow` skip their client effects while `demo` is on; `usePerformanceMonitoring` turns collection off and sends no `app_ready`; `bindErrorReports` is not bound and `sendReport` refuses while in the demo. Settings hides Computers, Notifications, Error reports and Performance cards and shows the Demo card; the Machine card hides Forget and the rename button.
- **Entry only without pairings.** **Try the demo** shows only when `computers` is empty, so a user adding a second computer never mixes the demo with real computers, and leaving always lands on the pairing screen.

## Risks / Trade-offs

- [The demo drifts from the real daemon's behavior] → the demo answers are validated against the protocol schemas in tests; screens stay unchanged, so a protocol change that breaks the demo breaks its tests.
- [Metro and package `exports` subpaths] → Expo SDK 57 resolves `exports`; the bundle is checked with `expo export`.
- [Demo state written by unaware features (drafts, pins)] → cleared on leave by session id; a future persisted per-session store must be added to the cleanup (noted in the module).
