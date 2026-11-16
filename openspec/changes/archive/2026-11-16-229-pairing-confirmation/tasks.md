## 1. Decision

- [x] 1.1 ADR-0009 (where and when the code is shown, length, attempts, expiry, compatibility, rejected options) and "Confirmation code" in `GLOSSARY.md`

## 2. Protocol

- [x] 2.1 Tests first in `packages/protocol/test/noise.test.ts`: the announce preface (mode `0x03`, pairing ID, nothing else); a pairing with the right confirmation code completes and one with a wrong code fails at `finish` as a wrong-code step; a pairing before any confirmation code is an announce; the old mode `0x01` is refused with 4002; `confirmationPsk` is HMAC-SHA256 of the context and the digits under the secret; the confirmation code generator gives six digits; verify they fail
- [x] 2.2 `channel.ts`: preface modes, `announcePreface`, `confirmationPsk`, `generateConfirmationCode`, `DeviceHandshake.pair` with `confirmation`, `DaemonHandshake` (`pairingConfirmation` hook, `announce` and `wrong-confirmation` steps), close codes 4011–4013; verify the tests pass
- [x] 2.3 `pairing.code.id` and `pairing.progress` in `server.ts` with parser tests; verify they pass

## 3. Daemon

- [x] 3.1 Tests first in `test/pairing.test.ts`: `PairingCodes` creates the confirmation code once per code, three wrong attempts burn it, the state reads waiting / presented / paired / locked / expired; verify they fail, then implement and verify they pass
- [x] 3.2 Tests first in `test/transport.test.ts` (a daemon in a temporary home): link alone fails (4012), link plus code pairs, three wrong codes burn the code (4013, then 4005) with a warning, the old mode is refused (4002), the admin status route reports the states, and `pairing.progress` reaches only the connection that created the code; verify they fail
- [x] 3.3 `secure-connection.ts` (announce closes with 4011 after `presented`, wrong codes close with 4012 / 4013), the pairing feature (hooks, owners, `pairing.progress`, `GET /admin/pairing-code/:id`, `pairing.presented` / `pairing.locked` bus events); verify the tests pass
- [x] 3.4 `remote-harness pair` and the setup wait after printing: the confirmation code, then paired / burned / expired, Ctrl+C stops; texts in pt-BR, en-US and es-ES; verify the CLI i18n parity test and a run against a daemon in a temporary home
- [x] 3.5 The tray: `pairing()` carries the confirmation code of the tray's code, the Pair a phone submenu and the Pairing tab show it, and the menu refreshes on `pairing.presented` and `pairing.locked`; a tray test for both rows; verify it passes

## 4. App

- [x] 4.1 Tests first in `features/pairing/test-connection.test.ts`: the announce over the targets (4011 → the target, 4005 → used, 4002 → update the computer, no answer → next target), the pairing with the code, and the failures for 4011, 4012 and 4013; the digits check (`confirmationDigits`); verify they fail, then implement and verify they pass
- [x] 4.2 `DaemonClient` passes the confirmation code to `DeviceHandshake.pair` and treats 4011–4013 as final; its pairing test pairs with the code; verify it passes
- [x] 4.3 The confirmation step in the pairing screen (title with the computer's name, explanation, six-digit field with the one-time-code keyboard, Pair, Cancel, errors) and `use-pairing` announcing, then pairing; texts in pt-BR, en-US and es-ES; verify typecheck and the i18n parity test
- [x] 4.4 Settings → Devices: the Add device sheet listens to `pairing.progress` for its code and shows the confirmation code, the paired outcome (refreshing the list) and the locked outcome; texts in the three languages; verify typecheck
- [x] 4.5 The demo daemon and its test keep answering every request

## 5. Docs

- [x] 5.1 `getting-started.md`, `security.md` and `daemon.md` in en-US, pt-BR and es-ES explain the confirmation code; verify the web docs tests

## 6. Verification

- [x] 6.1 `turbo run typecheck test` (all packages but the Go relay), Biome, `expo export --platform ios` and `openspec validate --all --strict` green
- [x] 6.2 With a daemon from source in a temporary home: `remote-harness pair` (pt-BR) waits, prints the code when a client announces (4011), a wrong code closes with 4012, and it prints that the device paired and exits 0 after the client pairs with the printed code
- [x] 6.3 On the iOS simulator (Release build, iPhone 17 Pro) against a daemon from source and the real `remote-harness pair`: the paste-link flow asks for the code titled with the computer's name while the terminal prints it, a wrong code shows the error and keeps the step open, the right one pairs and the terminal prints "Aparelho pareado."; Add device on the paired simulator shows the code when a scripted second device announces the QR, then "Aparelho pareado." and the new device in the list
- [ ] 6.4 Pending: a real phone scanning the tray's QR on macOS (the code in the menu and the Pairing tab), and Add device between two real devices
