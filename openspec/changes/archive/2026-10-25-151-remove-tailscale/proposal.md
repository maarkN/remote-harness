## Why

With the connection relay and the end-to-end channel in place (#363–#366), nothing in Remote Harness needs Tailscale any more, yet the code, the setup, the app, the docs, the landing and the store listing still ask for it (#367, the last part of #362). Store users will not have it, and a direct path over a tailnet keeps working without any Tailscale-specific code.

## What Changes

- Daemon: drop `findTailscaleAddress` (`infra/network.ts`), the `--wait-tailscale` flag (services installed before still start: `start` ignores flags it no longer has), the Tailscale checks of `doctor`, `pair` and `service install`, the setup's Tailscale step (replaced by a pairing step) and the WSL Tailscale detection (mirrored networking stays, offered for the direct path); i18n and tests.
- App: the setup guide without the Tailscale steps, the unreachable checklist without "Open Tailscale" (computer on, daemon running, both online), pairing and timeout texts, the local network permission copy, store keywords and description; `NSAllowsArbitraryLoads` / `usesCleartextTraffic` narrowed to what the direct path needs (`ws://` on local and private addresses carrying Noise frames).
- Dev tooling: `make install-ios-link` publishes only through the site (`IOS_LINK=web` becomes the only mode).
- Docs in pt-BR, en-US and es-ES: README (both), `SECURITY.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `Makefile` help, the web docs (getting started, daemon, security, privacy, troubleshooting, index) and the landing copy.
- Specs: the requirements that still name Tailscale.

## Capabilities

### New Capabilities

### Modified Capabilities

- `app-session-list`: unreachable checklist without Tailscale.
- `guided-installer`: the in-app tutorial without Tailscale.
- `daemon-service`: no `--wait-tailscale`, no waiting for an interface.
- `platform-support`: WSL direct path instead of a Tailscale address.
- `project-domain`: the device install link requirement renamed.
- `web-docs`: search example.
- `web-landing`: install requirements without Tailscale.

## Impact

- Daemon: `cli.ts`, `main.ts`, `infra/network.ts` (removed), `features/setup/wizard.ts`, `features/service/{launchd,systemd}.ts`, `features/wsl/*`, i18n, tests.
- App: `features/pairing/setup-guide.ts`, `SetupGuideScreen.tsx`, `features/sessions/components/UnreachableEmptyState.tsx`, i18n, `store/metadata.ts`, `app.config.ts`, `scripts/ios-link*.ts`.
- Web: `content/*`, `src/i18n/*`, `test/docs.test.ts`. Root docs and `Makefile`.
- In-flight changes 25 and 27 lose their Tailscale mentions.
