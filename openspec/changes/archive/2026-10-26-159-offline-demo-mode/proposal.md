## Why

Google Play's app review ("App access") needs a way into the restricted parts of the app, but Remote Harness has no accounts: the only way past the pairing screen is a QR code printed by the daemon on the user's own computer, which a reviewer will not set up. A public demo daemon would break the security model (WebSocket only on Tailscale or `127.0.0.1`, per-device keys), so without an offline way in the review can block releases (#395).

## What Changes

- The pairing screen offers **Try the demo** while no computer is paired. It opens the app on a fictional computer that lives entirely inside the app: no network, nothing saved, no real credentials.
- A demo daemon in the app answers the WebSocket protocol behind a fake socket (`DaemonClientOptions.socketFactory`), with a real in-memory Noise handshake, so every screen runs unchanged: session list (waiting, running, idle, ended), conversation with tool calls, permission approval, raw terminal with the Claude Code mode line, subagents, changes, settings. Actions answer locally with fictional results; what the demo cannot do answers with a localized "not available in the demo".
- A demo banner on the main screens, and a Demo card in Settings, with **Leave demo**, which returns to pairing and clears every bit of demo state (sessions, drafts, pins) without touching real pairings.
- Push registration, Live Activities / live status, error reports and performance data stay off while the demo runs; their Settings cards are hidden.
- The fictional sessions move to a shared module (`@remote-harness/protocol/demo`) used by both the daemon's screenshot demo and the in-app demo, so screenshots and the store review show the same data.
- The repository keeps the Google Play "App access" instructions pointing reviewers to **Try the demo**.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `demo-mode`: adds the in-app offline demo, its exit, what stays off during it, and the fixtures shared with the daemon demo.
- `app-pairing`: the pairing screen offers **Try the demo** while no computer is paired.
- `store-distribution`: the App access instructions for store review point to the in-app demo.

## Impact

- `packages/protocol`: new `./demo` subpath export with the fictional fixtures and the pane renderer (pure, no Node APIs).
- `apps/daemon/scripts/demo-data.ts`: imports the fixtures from the shared module; output unchanged.
- `apps/mobile`: new `src/features/demo/` (demo daemon, demo socket, fixtures adapter, banner, enter/leave); `connection-store` gains a demo flag and `enterDemo`; push, live status, performance and error reports check it; pairing screen, main layout and Settings show the demo entry, banner and card; i18n keys in pt-BR, en-US and es-ES.
- `apps/mobile/store/app-access.md`: reviewer instructions (copied into Play Console by hand).
- No protocol message changes; the daemon is unaffected at runtime.
