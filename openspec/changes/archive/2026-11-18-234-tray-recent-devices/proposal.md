## Why

The tray lists every paired device (#619). With six of them, the Devices card takes most of the popover, mostly with offline phones paired weeks ago, and the plain menu on Linux and Windows grows the same way. Also, the menu bar glyph is drawn at 18 points and reads small next to the system icons; the user asked for it about 20 % bigger.

## What Changes

- Popover (macOS):
  - The Devices card shows at most three devices: those online now first, then the most recently seen. Devices never seen go last, newest pairing first.
  - When more are paired, a "See all devices (N)…" link follows the rows. It opens the Devices tab of the Preferences window (`prefs:devices`, the same action a device row has), which lists every device.
- Plain menu:
  - The same cap and order apply.
  - On a helper that can open windows, the section ends with a "See all devices (N)…" item opening that tab.
  - On a helper without window support (Linux, Windows), it ends with a "See all devices (N)" submenu holding every device with its usual submenu (when it paired, Revoke…), so none becomes unreachable from the tray.
- The macOS menu bar glyph is drawn at 22 points instead of 18 (+22 %), the tallest that fits a 22–24 pt menu bar. The popover header keeps its own 22 pt mark.
- Labels in pt-BR, en-US and es-ES.
- Tests for the popover builder and the menu: the cap, the order, the link or submenu and its count, and no link with three devices or fewer.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `desktop-updates`:
  - "Tray icon": the glyph size on macOS, plus the menu's device cap, its order and "See all devices".
  - "Tray popover": the Devices card's cap, its order and the link.

## Impact

- Daemon:
  - `features/updates/popover.ts`: the cap, the order and `devices.more`.
  - `features/updates/menu.ts`: the shared order and the cap, the item or submenu.
  - `tray/macos/Tray.swift`: decodes and draws `devices.more`; the glyph is 22 pt.
  - The i18n catalogs: `seeAllDevices`.
  - Tests.
- The macOS helper is compiled on the computer when the daemon starts, so the new popover and glyph arrive with `remote-harness update`.
- No protocol or app change.
