## 1. Daemon data

- [x] 1.1 `Connection.path` set from `acceptSecureConnection`'s meta and `ClientHub.devicePaths()`; covered by a hub test
- [x] 1.2 `renameProfileInConfig` (pure `withProfileName` + config write) refusing empty names; Vitest
- [x] 1.3 Tray shell deps: devices, connected paths, revoke, daemon paths and network settings wired in `main.ts`; `pnpm turbo run typecheck`

## 2. Builders

- [x] 2.1 i18n: new tray strings (paths, devices, network, popover, profile fields) in en-US, pt-BR and es-ES; parity test passes
- [x] 2.2 `menu.ts`: status line with the paths, Devices section with Revoke… confirmation submenu replacing the phone count; Vitest
- [x] 2.3 `menu.ts`: Preferences window tab order, editable Profiles, Network and Devices tabs, button `confirm` text and section titles; Vitest
- [x] 2.4 `popover.ts`: `buildTrayPopover` (header, pending card, 5 sessions + see all + ended, devices, actions); Vitest

## 3. Daemon wiring

- [x] 3.1 `TrayHost` reports `popover` from `ready`; the payload is only sent to helpers that support it; Vitest
- [x] 3.2 Clicks: `revoke:<id>`, `profile-name:<id>`; refresh on device connect, disconnect and revoke; Vitest where pure

## 4. Helpers

- [x] 4.1 macOS: SwiftUI popover (transient `NSPopover`) rendering the payload in dark and light, with NSMenu fallback; `swiftc` builds
- [x] 4.2 macOS: Preferences window — tab selection (`prefs:<tab>`), section titles, `entry` rows with buttons, confirmation text; `swiftc` builds
- [x] 4.3 Linux: renders the new menu (no protocol change); `python3 -m py_compile`

## 5. Wrap-up

- [x] 5.1 Docs: tray section of the web docs mentions the popover, Network and Devices (if the docs describe the tray)
- [x] 5.2 `pnpm turbo run typecheck test` and Biome green
