## 1. Protocol

- [x] 1.1 Tests first: `devices.rename` accepted with a trimmed name, rejected (`bad_request`) when empty, only spaces or over 64 characters, or without `deviceId`; `deviceIdOf` gives the daemon's IDs (first 8 bytes of SHA-256 of the key, hex); verify they fail
- [x] 1.2 `devices.rename` in `client.ts` and `deviceIdOf(crypto, publicKey)` in the protocol package; the daemon's `deviceIdOf` uses it; verify the tests pass

## 2. Daemon

- [x] 2.1 Tests first: `PairedDevices.rename` stores the name and survives a reload, false for an unknown ID; the `devices.rename` handler (through a daemon started in a temporary home) answers the updated list (the asking device marked) or `not_found`; verify they fail
- [x] 2.2 `PairedDevices.rename`, the handler next to `devices.list`, the `device.renamed` bus event and the tray refresh on it; verify the tests pass and typecheck

## 3. App

- [x] 3.1 `npx expo install expo-device`; check that `pnpm-lock.yaml` only gains `expo-device` (and its `ua-parser-js`); verify typecheck
- [x] 3.2 Tests first in `features/pairing/device-name.test.ts`: the suggested name (user name unless generic, else the model, else the platform default; trimmed and cut to 64) and the name check (1–64 after trimming); verify they fail, then write `device-name.ts` and verify they pass
- [x] 3.3 The name step: route `src/app/name-device.tsx` and `NameDeviceScreen` (prefilled field, Save once the connection is open, Skip, error with retry); `use-pairing` opens it after a successful pairing instead of the session list; texts in pt-BR, en-US and es-ES; verify typecheck and the i18n parity test
- [x] 3.4 Settings → Devices: a rename action on each row opening a sheet with the name prefilled, Save sends `devices.rename` and shows the returned list; texts in the three languages; verify typecheck

## 4. Verification

- [x] 4.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 4.2 With a daemon from source in a temporary home (`transport.test.ts`): a client renames itself and another device, the device store has both names, an unknown ID gets `not_found`
- [x] 4.3 On the iOS simulator (Release build, iPhone 17 Pro) against a daemon from source: pairing shows the name step prefilled with "iPhone 17 Pro" (iOS only gives "iPhone" as the device name), Save renames it on the computer (`devices list` shows it), and Settings → Devices renames the row in its sheet; a long name no longer runs the "this device" badge into the rename action
- [ ] 4.4 Pending: the suggested name on a real iPhone, iPad and Android phone; Skip on the name step
