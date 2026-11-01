## Context

The tray helpers are thin renderers: the daemon builds a translated `TrayMenu` (`features/updates/menu.ts`) and sends it as JSON lines; the helper draws it and reports clicks (`{type:'click', id, value?}`). The macOS helper (`tray/macos/Tray.swift`, compiled by `swiftc` on first use and cached by source hash) already hosts SwiftUI windows (Preferences, Sessions) fed by optional fields of the same message, unlocked when it answers `{type:'ready', windows:true}`. The popover, the Network/Devices tabs and the device list need data the tray does not have yet: the paired devices, which of them are connected and by which path, and the daemon's paths (`connectivity.paths()`).

## Goals / Non-Goals

**Goals:** keep the "helper only lays out" rule for the popover (every label, count and relative time comes from the daemon); one pure builder per surface, tested with Vitest; Linux keeps working with no change to its renderer.

**Non-Goals:** editing the network settings (direct/relay on/off, relay list) from the tray — they stay read-only, since they only apply on the daemon's next start; editing a profile's agent, color or config folder; the Windows tray (#435).

## Decisions

- **A separate `popover` payload, not a re-interpretation of the menu items.** The menu is a flat list of strings built for `NSMenu`/GTK; the popover needs structure (cards, pills, badges, counts). `buildTrayPopover(state, t)` in a new `popover.ts` returns `{ header, pending, sessions, devices, actions }` with every string already translated and tones as enums (`running`, `waiting`, `idle`, `ended`, `online`, `offline`, `accent`). It is only sent once the helper reports `popover: true` on `ready`, like `windows`. Alternative considered: render the popover from `items` — rejected, it would push layout decisions (which item is a card, which a pill) into Swift.
- **Elapsed time is the one value the helper computes.** The waiting card shows `0:52` ticking; resending the menu every second for that would be wasteful. The daemon sends the request's `createdAt` (ISO); the helper formats `m:ss` (digits only, nothing to translate).
- **Agent badge and colors live in the helper.** The badge is the agent id's first two letters on the agent's fixed color (`agents.ts` values: Claude Code `#D97757`, Codex `#2FBF8F`, Kimi `#5B9BF5`, Qwen `#8C6CF5`), a fixed table like the glyph's amber. The profile color comes from the config.
- **Device presence from the hub.** `Connection` gains `path: 'direct' | 'relay'` (set where `acceptSecureConnection` already receives it) and `ClientHub.devicePaths()` returns `deviceId → paths`. The updates feature refreshes the tray on `onClientConnected`, on each connection's close and on `device.revoked`; pairing a device ends in an authenticated connection, so it is covered too.
- **Revocation reuses `PairingFeature.revoke`.** Action id `revoke:<deviceId>`; macOS confirms in the helper (the button carries a `confirm` text), the menu uses a nested confirmation submenu like other destructive menu items.
- **Profile rename.** Action `profile-name:<id>` with the new name as `value`. `renameProfileInConfig` reads the raw config, replaces the name of the profile with that id (keeping `configDir` unexpanded), and writes it with `updateConfigFile`. The tray keeps its own name overrides so its rows show the new name at once; `hello` keeps the start-time profiles, as with the machine name.
- **Helper-local tab selection.** "Pair a phone…" in the popover (once the daemon listens) and a device row click are helper-local ids `prefs:pairing` / `prefs:devices`: the helper opens the Preferences window on that tab without a round trip, like `see-all`.
- **Paths label.** `pathsLabel(addresses, relay)` → `direct + relay paths` / `direct path` / `relay path` / `not reachable yet`, translated; shared by the menu status line and the popover header.

## Risks / Trade-offs

- [The popover replaces the menu: a SwiftUI bug would leave the user with no tray actions] → the helper falls back to the `NSMenu` when no popover payload arrives, and the daemon keeps sending `items`.
- [`NSPopover` from an accessory app does not close on outside clicks unless `behavior = .transient`] → use `.transient` and close it after each action.
- [Many tabs in a fixed-size window] → widen the Preferences window to fit eight tabs.

## Migration Plan

None: the helper is rebuilt from source on the next daemon start (new source hash); older daemons never send `popover`.
