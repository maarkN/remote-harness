## 1. Builders

- [x] 1.1 Tests first in `test/tray-popover.test.ts` and `test/tray-menu.test.ts`: with a live session outside tmux, a tmux session and an ended one, the popover row of the first has `outsideTmux` with the tag and the explanation and no action, the tmux row has an action and no `outsideTmux`; the menu labels the first `title · state · outside tmux` with the disabled explanation first in its submenu, and leaves the others as before; the Sessions window strings carry the tag and the explanation; the pt-BR tag is "fora do tmux". Verify they fail
- [x] 1.2 `outsideTmux` / `outsideTmuxHint` in the three catalogs; the popover row's `outsideTmux`, the menu label and line, and the Sessions window strings; verify the tests in 1.1, the rest of the tray tests and the i18n parity tests pass

## 2. macOS helper

- [x] 2.1 `Tray.swift`: decode the row's `outsideTmux` and the Sessions window strings; the popover row draws the muted title, the tag and the tooltip (`.help`), the Sessions window row the tag and the tooltip; verify `swiftc -O tray/macos/Tray.swift` builds without errors or warnings
- [x] 2.2 See it: the helper built from this branch, fed a popover message with a session outside tmux and one in tmux, renders the two rows (screenshot of the popover window)

## 3. Verification

- [x] 3.1 `pnpm check` green (typecheck, tests, Biome with warnings as errors); locally without the Go relay, which has no toolchain on this Mac and runs in CI
- [ ] 3.2 Pending, on the user's Mac after `remote-harness update`: a session started with plain `claude` shows the tag and the tooltip in the popover and the Sessions window, and a click on it does nothing
