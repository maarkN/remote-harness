## Why

Every device pairs under a fixed name taken from its platform: `deviceInfo()` sends "iPhone", "iPad" or "Android" in the pairing handshake, and that is what `paired-devices.json`, `remote-harness devices list`, the tray and Settings → Devices show (#592). With two phones, or a phone and a tablet of the same kind, the rows look the same and revoking the right one is a guess.

## What Changes

- Right after a successful pairing the app asks for this device's name on its own screen, prefilled from `expo-device` (the user-assigned device name when the system gives one that is not just "iPhone" / "iPad", else the model, such as "iPhone 15 Pro" or "Pixel 8", else the platform default), with **Save** and **Skip** (keeps the platform default). Save sends the name to the daemon once the connection is open.
- Settings → Devices gets a rename action on every row (this device and the others, like revoke), in a sheet with the current name prefilled.
- Protocol: `devices.rename { deviceId, name }` (the name trimmed, 1–64 characters; anything else is `bad_request`), answered with `devices.result` (the updated list); `not_found` for an unknown ID. Handled like every request, so only on an authenticated connection. `deviceIdOf(crypto, publicKey)` moves to the protocol package so the app can name its own ID; the daemon keeps using the same derivation.
- Daemon: `PairedDevices.rename` stores the name; `devices.list`, the admin route (`remote-harness devices list`) and the tray show it at once (a `device.renamed` bus event refreshes the tray). The name inside the Noise pairing payload stays the platform default; push registration (`device.register`) is untouched.
- New native dependency `expo-device` (installed with `npx expo install`): the next store build carries it; its runtime fingerprint changes.
- Texts in pt-BR, en-US and es-ES; Vitest for the name validation, the suggested name, the store and the daemon handler.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `protocol`: "Paths, devices and lean traffic messages" (`devices.rename`).
- `daemon-auth`: "Paired devices" (renaming).
- `app-pairing`: "Pairing code scan" (the name step after pairing).
- `app-computers`: "Devices settings" (rename a device).

## Impact

- Protocol: `client.ts` (`devices.rename`), `noise/channel.ts` or a small helper (`deviceIdOf`).
- Daemon: `features/pairing/devices.ts` and `index.ts`, `core/identity.ts`, `core/events.ts`, `features/updates/index.ts` (tray refresh), tests.
- App: new route `src/app/name-device.tsx` and `features/pairing/NameDeviceScreen.tsx`, `features/pairing/device-name.ts` (+ test), `use-pairing.ts`, `features/settings/DevicesCard.tsx`, the three catalogs, `package.json` (`expo-device`).
