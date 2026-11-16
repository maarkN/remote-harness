## Why

The pairing code (`remoteharness://pair?…`, ADR-0002) carries everything a device needs, including the single-use secret that is the XXpsk3 PSK. Whoever sees the QR or the link within its 5 minutes (a screenshot in a chat, a terminal shared on a call, `remote-harness pair` pasted somewhere) can pair before the owner does, and nothing on the computer asks for consent (#593). ADR-0009 adds a second factor that never travels in the link.

## What Changes

- **Announce, then pair.** After scanning, the app first sends an announce connection (preface mode `0x03` with the pairing ID, nothing else). The daemon creates the pairing code's **confirmation code** (6 random digits, once per pairing code), shows it where the pairing code was shown, and closes with 4011. The app asks for the digits and pairs with preface mode `0x04`: XXpsk3 with the PSK `HMAC-SHA256(secret, "remote-harness pairing confirmation" ‖ 0x00 ‖ digits)`.
- **Attempts and expiry.** A wrong code closes with 4012 and counts; the third wrong code burns the pairing code (4013) and the daemon logs a warning. The confirmation code expires with its pairing code (5 minutes from creation).
- **Where the code is shown.** `remote-harness pair` and the setup keep running after the QR and print the code when a device presents it, then that it paired, was burned or expired (Ctrl+C stops waiting; a new admin route reports the code's state). The tray's Pair a phone submenu and Pairing tab show the code under the QR. "Add device" on a paired phone gets `pairing.progress` (presented with the code, paired, locked), sent only to the connection that created the pairing code, and its sheet shows the code and the outcome.
- **The phone.** A clear step after scanning: "Enter the code shown on <computer>", a 6-digit field, Pair and Cancel; errors for a wrong code, a burned code, and a computer that must be updated; texts in pt-BR, en-US and es-ES.
- **Compatibility.** The link keeps `v=2` (a bump would make older apps say only "Invalid QR"). **BREAKING** for pairing only: the daemon refuses the old pairing mode `0x01` with 4002, which older apps show as "update both"; a new app announcing to an older daemon gets 4002 and tells the user to update the computer. Reconnecting (mode `0x02`, IK) is unchanged.
- The pairing docs (getting started, security, the daemon's `pair` command) explain the code in the three languages.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `daemon-auth`: "End-to-end encrypted channel" (modes `0x03` / `0x04`, `0x01` refused, close codes 4011–4013), "Pairing codes" (the confirmation code, attempts, expiry, where it is shown), "Pairing code for another device" (`pairing.progress`).
- `protocol`: "Paths, devices and lean traffic messages" (`pairing.code.id`, `pairing.progress`).
- `app-pairing`: "Pairing code scan" (announce, the confirmation step and its errors).
- `app-computers`: "Devices settings" (the Add device sheet shows the code and the outcome).
- `desktop-updates`: "Pair a phone from the tray" (the code under the QR).

## Impact

- Protocol: `noise/channel.ts` (preface modes, `confirmationPsk`, `DeviceHandshake.pair` with the code, `DaemonHandshake` announce and wrong-code steps, close codes), `server.ts` (`pairing.progress`, `pairing.code.id`), tests.
- Daemon: `features/pairing/codes.ts` (confirmation code, attempts, outcomes), `features/pairing/index.ts` (hooks, owners, admin status route, bus events), `transport/secure-connection.ts`, `core/events.ts`, `cli.ts` (`printPairing` waits), tray menu and Preferences rows, the three CLI catalogs, tests.
- App: `features/pairing/` (announce, the confirmation step, `use-pairing`, `test-connection` failures), `core/connection/daemon-client.ts` (the code in the pairing, final close codes), `features/settings/DevicesCard.tsx`, the three catalogs, tests.
- Docs: ADR-0009, `GLOSSARY.md` (confirmation code), `apps/web/content/*/getting-started.md`, `security.md`, `daemon.md`.
