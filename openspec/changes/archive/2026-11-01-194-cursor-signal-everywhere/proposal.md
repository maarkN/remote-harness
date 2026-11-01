## Why

#494 moved the generated assets to the Cursor Signal, but four places still draw the Tether's geometry by hand and keep showing the old mark: the sessions list header, the site (favicon, landing, install link page), the macOS and Windows tray glyphs and the setup banner (#495). The product should show one mark everywhere.

## What Changes

- `apps/mobile/src/ui/Mark.tsx`, `apps/web/src/site.ts` (`MARK_REGULAR`, `MARK_BOLD`, `faviconSvg()`), `apps/daemon/tray/macos/Tray.swift` (`glyph(_:)`), `apps/daemon/tray/windows/Tray.cs` (`Glyph`) and `apps/daemon/src/features/setup/banner.ts` (`ICON`) draw the Cursor Signal from the same 256-box geometry as `icons.mts`.
- Tray states get a new mapping, since the mark has no ring: `working` fills the cursor block solid (the prompt disappears, like a busy cursor), `waiting` keeps the amber dot over the outer arc's upper end, `offline` keeps the 40 % opacity (now on macOS too), `idle` is the plain template glyph.
- The setup, installer and doctor banners draw the mark in block characters (a 5-column block with the prompt cut out and three arcs), in amber, within 80 columns, with a test on the width.
- The favicon follows the icon: the bold mark in a 78 % box on `#1C1A17` with 22 % corners.
- Prototypes `icon-macos-menubar`, `tray-popover-macos`, `tray-linux` and `tray.html` use the new state variable and are re-exported; the `product-identity` spec gets the state mapping and the banner.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `product-identity`: "Brand mark" (the hand-drawn copies, the tray state mapping, the banner).

## Impact

- App header mark (`Mark.tsx`, now with an SVG mask for the cutout), the site's inline marks and favicon, the two tray helpers (compiled on the user's computer by the daemon), the banner; prototypes and screens. No protocol change; the app side ships over the air, the tray glyphs with the next daemon update.
