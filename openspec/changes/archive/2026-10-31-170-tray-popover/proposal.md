## Why

The macOS tray shipped as a plain `NSMenu` (changes 65, 104, 112), while the identity prototype (`docs/design/identity/screens/tray-popover-macos.html`) designs a popover with cards: the computer header, the waiting permission answerable in place, a short session list, the paired devices and the quick actions (#434, split from #160). The Preferences window also still shows profiles read-only, has no view of how devices reach the computer (direct or relay path), and the menu only counts phones instead of listing them, so revoking a lost phone needs the CLI or another device.

## What Changes

- **macOS popover.** A helper that reports popover support (the macOS one) gets a structured, fully translated `popover` payload with the menu and shows it in a SwiftUI popover anchored to the menu bar icon instead of the `NSMenu`: a header (computer name, its paths — direct and/or relay, never an IP —, version, start time and a state pill), **Waiting for you** with the oldest pending tool permission as a card (agent badge, session title, profile, `Tool · detail`, elapsed time, Deny / Always / Allow, or only Open in terminal when "Show permission requests here" is off), **Sessions** (5 live sessions as rows with agent badge, folder · profile · worktree and a state pill, a click focuses the session, a context menu offers Rename… and Close session; "See all sessions…" and the ended count open the Sessions window), **Devices** (each paired device with when it paired and whether it is online now and by which path), and the quick actions (New session…, Pair a phone…, Open the docs, Preferences…, the update state — Check for updates with the channel, Update now, Updating… — and Quit). It follows the system appearance (dark and light).
- **Preferences window.** New **Network** tab (direct path on/off and its addresses, connection relay on/off and the home relay, devices connected now by path) and **Devices** tab (each paired device with platform, paired and last seen times, online state, and Revoke… with a confirmation). The **Profiles** tab becomes editable: each profile's name is a text field written to the config file (agent and config folder shown read-only). Tabs follow the prototype's order: General, Profiles, Notifications, Network, Devices, Pairing, Updates, Advanced.
- **Menu helpers (Linux, macOS fallback).** Same sections in the same order as the popover within menu limits: the status line shows the paths instead of nothing about reachability, and **Devices** lists each paired device (online state and path) with a Revoke… submenu whose nested confirmation revokes it, replacing the count-only "Phones" line. The menu header of the device section uses the glossary term "Devices".
- Device revocation from the tray reuses the daemon's existing revoke (closes its connections, drops its push), so it behaves like `remote-harness devices revoke`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`: "Tray icon" (status line with the paths, Devices section with revoke instead of the phone count), new "Tray popover" requirement, "Tray preferences" (Network and Devices tabs, editable profile names, tab order).

## Impact

- `apps/daemon/src/features/updates/menu.ts` (menu + Preferences window builders, new action ids), new `popover.ts` (pure popover builder), `index.ts` (state, clicks: revoke, profile rename, refresh on device connect/disconnect/revoke), `tray-host.ts` (`ready` reports `popover`).
- `apps/daemon/src/transport/connection.ts` / `secure-connection.ts`: a connection knows its path; the hub lists connected devices by path.
- `apps/daemon/src/core/config.ts`: renaming a profile in the config file.
- `apps/daemon/src/main.ts`: wires devices, revoke and paths into the tray shell.
- `apps/daemon/tray/macos/Tray.swift`: SwiftUI popover, Preferences tab selection, new row kinds.
- `apps/daemon/tray/linux/tray.py`: unchanged protocol; renders the new menu items.
- Daemon i18n (`core/i18n/*.ts`): new tray strings in en-US, pt-BR and es-ES.
