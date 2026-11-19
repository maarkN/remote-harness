## 1. Order and cap

- [x] 1.1 Tests first in `test/tray-popover.test.ts` and `test/tray-menu.test.ts`. With six devices (one online, the others seen at different times, one never seen):
  - Popover: lists the online one and then the two most recently seen. `devices.more` is "See all devices (6)…" with the `prefs:devices` action.
  - Menu with `windows`: three devices and a "See all devices (6)…" item with `prefs:devices`.
  - Menu without windows: three devices and a "See all devices (6)" submenu with all six, each still with Revoke….
  - With three devices: no link, no item and no submenu.
  - The texts in pt-BR.

  Verify they fail.
- [x] 1.2 `menu.ts`: `MAX_TRAY_DEVICES = 3` and `recentDevices()`, ordering online first, then by last seen, with never seen last by pairing time. Use them in the menu, and in `buildTrayPopover`, which gets `devices.more`. Add `seeAllDevices` to the three catalogs. Verify the tests in 1.1, the existing tray tests and the i18n parity tests pass.

## 2. macOS helper

- [x] 2.1 `Tray.swift`: `PopoverDevicesWire.more` and a `LinkRow` after the device rows; the menu bar glyph at 22 pt (`glyphSide`). Verify `swiftc -O tray/macos/Tray.swift` builds without errors or warnings.
- [ ] 2.2 Pending (folded into 3.2): looking at the popover and the glyph needs the user's screen, so it was not checked from here. A second helper icon and a screenshot of the user's menu bar were left out on purpose.

## 3. Verification

- [x] 3.1 `pnpm check` green (typecheck, tests, Biome with warnings as errors). Locally the Go relay is left out, because there is no Go toolchain on this Mac.
- [ ] 3.2 Pending, on the user's Mac after `remote-harness update`:
  - the popover with more than three devices shows three and the link, which opens Preferences → Devices;
  - the menu bar glyph is visibly bigger and still centered.
