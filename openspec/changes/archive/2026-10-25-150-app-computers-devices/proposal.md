## Why

The daemon now serves devices over the connection relay and directly, lists its devices and hands out pairing codes (#365), but the app still keeps one computer and only dials one direct address (#366, part of #362). A user with a laptop and a desktop, or a phone and a tablet, needs several computers in one app, devices they can add and revoke, and a connection that works from anywhere and prefers the direct path at home.

## What Changes

- Credentials become a list of computers (one SecureStore item each plus an index with the active one): daemon ID, daemon key, device key pair, direct addresses, home relay, relay list, alias. The single item of the previous version moves into the list.
- `DaemonClient` tries the direct addresses, then the home relay, then the other relays (by daemon ID); a relay that answers 4004 (daemon not there) moves on to the next one. While on the relay it probes the direct addresses every 30 s and when the app returns to the foreground, and moves to a direct connection that authenticates, without dropping the conversation (stores resubscribe from their cursors). `daemon.paths` updates the saved addresses and relay. The connection exposes which path it uses.
- Computer switcher on the session list (the machine line opens it): one active connection, add a computer (pairing screen), switch. Push and live status keep arriving from every computer; the daemon adds its daemon ID to push data and to the live status link, and tapping a notification switches to its computer. Background answers (Allow / Deny from a notification, live status registrations) use the notification's computer with IK.
- Settings → Computers: list, rename (alias), forget (wipes that computer's keys, alias and, for the active one, its drafts). Settings → Devices (the active computer): list with name, platform and last seen, "Add device" (`pairing.create`, shown as a QR and a link), revoke with confirmation. A device revoked elsewhere (4007) is signed out of that computer.
- Pairing works over the code's relay too when no direct address answers.
- i18n in pt-BR, en-US and es-ES.

## Capabilities

### New Capabilities

- `app-computers`: the computer list, the switcher, path selection and the move back to direct, the Devices and Computers settings.

### Modified Capabilities

- `app-pairing`: secure storage of several computers, forget per computer, pairing over the relay.
- `push-notifications`: notifications carry the daemon ID; tapping one or answering from it uses its computer.

## Impact

- App: `core/storage/` (computers index), `core/connection/` (store with several computers, path plan and upgrade in `DaemonClient`, `short-lived.ts`), `features/sessions/components/MachineLine.tsx` + switcher sheet, `features/settings/` (Computers and Devices cards, machine aliases per computer), `features/push/` (payload, taps, background answers), `features/pairing/` (relay fallback), i18n, tests. New dependency `uqr` (pure JS QR encoder) for the Add device QR.
- Daemon: `features/push/service.ts` (`daemonId` in push data), `features/live-status` (link with the computer).
