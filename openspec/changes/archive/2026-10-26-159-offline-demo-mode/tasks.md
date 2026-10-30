## 1. Shared fixtures

- [x] 1.1 Move the fictional profiles, repositories, sessions, pane renderer and types to `packages/protocol/src/demo/` (no Node APIs) behind a `./demo` subpath export, add subagents to the running session; verify with the protocol typecheck
- [x] 1.2 Make `apps/daemon/scripts/demo-data.ts` re-export them and build `demoConfig` from the shared profiles; verify the daemon's demo tests still pass unchanged

## 2. Demo daemon (app, pure)

- [x] 2.1 `features/demo/fixtures.ts`: adapt the fixtures to protocol sessions, transcript entries, subagents, permission request, limits and changes under `/Users/demo`; verify with Vitest that every value parses with the protocol schemas
- [x] 2.2 `features/demo/demo-daemon.ts`: answer every client message type (auth, lists, subscribe/history, pane, permission respond/answer, input with a fictional reply, mode, mute, settings lists, changes) and "not available in the demo" for the rest; verify with Vitest that every reply and event parses with `ServerMessageSchema` and that the permission and input flows move the session on
- [x] 2.3 `features/demo/demo-socket.ts`: `SocketLike` with an in-memory Noise responder in front of the demo daemon; verify with Vitest that a real `DaemonClient` with node crypto authenticates and gets the session snapshot through it

## 3. App integration

- [x] 3.1 Connection store: `demo` flag and `enterDemo`, cleared by every other connect; verify with Vitest that pairing a computer ends the demo and that the demo computer is never saved
- [x] 3.2 `features/demo` enter/leave (key pair per run, cleanup of drafts, pins and hidden sessions of the demo ids); verify the cleanup with Vitest
- [x] 3.3 Gates: push, live status, live follow, performance and error reports stay off in the demo; verify with typecheck and by reading each hook's early return
- [x] 3.4 Pairing screen **Try the demo** (only without paired computers), demo banner on the main layout, Demo card in Settings with the Computers, Notifications, Error reports and Performance cards hidden and Machine card's Forget and rename hidden; verify with typecheck and `expo export`
- [x] 3.5 i18n keys in pt-BR, en-US and es-ES (entry, banner, card, unavailable message, fictional reply); verify the parity tests

## 4. Store and docs

- [x] 4.1 `apps/mobile/store/app-access.md` with the reviewer instructions; verify the file reads standalone
- [x] 4.2 Update the main `demo-mode` spec Purpose to cover the in-app demo; verify `openspec validate --specs --strict`

## 5. Verification

- [x] 5.1 `turbo run typecheck test`, Biome with `--error-on-warnings`, and `npx expo export --platform ios` all green
