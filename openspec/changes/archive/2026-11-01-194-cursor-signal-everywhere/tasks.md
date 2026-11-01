## 1. Hand-drawn copies

- [x] 1.1 `apps/mobile/src/ui/Mark.tsx` draws the Cursor Signal with a mask for the prompt; `pnpm --filter @remote-harness/mobile typecheck` and the theme's no-hex test pass
- [x] 1.2 `apps/web/src/site.ts`: `MARK_REGULAR`, `MARK_BOLD` and `faviconSvg()` from the same geometry; the favicon test checks the cutout and the flat container (`pnpm --filter @remote-harness/web test`)
- [x] 1.3 `Tray.swift` `glyph(_:)` and `Tray.cs` `Glyph` draw the mark with the four states (solid block, amber dot over the outer arc, 40 % offline); `xcrun swiftc -typecheck` passes on the Swift helper
- [x] 1.4 `banner.ts` `ICON` in block characters; a test asserts every logo line fits 80 columns and the art keeps its width (`pnpm --filter @remote-harness/daemon exec vitest run test/i18n.test.ts`)

## 2. Prototypes and spec

- [x] 2.1 `icon-macos-menubar.html`, `tray.html`, `tray-linux.html`, `tray-popover-macos.html` use `--cutout` for the working state; `icon-macos-menubar.png`, `tray-linux.png`, `tray-popover-macos.png` re-exported
- [x] 2.2 `product-identity` "Brand mark" delta; `openspec validate 194-cursor-signal-everywhere --strict`

## 3. Verify

- [x] 3.1 `pnpm turbo run typecheck test`, Biome (worktree ignore tweak), `npx expo export --platform ios`
