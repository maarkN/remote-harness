## Why

The app icon and every asset generated with it still use the first mark, "the Tether" (#494). The identity moves to the designer's concept 02, "Cursor Signal": a terminal cursor block with the `>` prompt cut out of it and three signal arcs leaving it to the right, the prompt leaking out of the computer. Same amber, now on a flat warm dark.

## What Changes

- `apps/mobile/scripts/icons.mts` draws the Cursor Signal (the 256-box geometry of the designer's `icon.svg`) instead of the Tether and regenerates every asset: `assets/icon.png`, `assets/icon/*.svg` (the standalone mark in two weights and the four sheet variants: amber on warm dark, inverted, light, mono), splash, favicon, Live Activity icon, Android adaptive, monochrome and notification icons, the five alternate app icons per theme, the Linux tray symbolic icon, `docs/brand/og.png` and the Google Play feature graphic.
- The icon container is flat `#1C1A17`, no gradient and no glow; the mark sits in a 78 % box, centered. The favicon keeps 22 % rounded corners.
- A bold weight stays for sizes under 24 px (wider cutout, thicker arcs), checked on the notification icon, the favicon, the Live Activity icon and the Linux symbolic icon.
- The designer's SVG sources join the repository under `docs/design/identity/branding/`; the prototype sprite (`shared.js`) switches to the new mark, so every identity page follows; the construction section of `icons.html` describes the Cursor Signal; the `icon-ios`, `icon-android`, `splash` and `og-readme-banner` screens are re-exported.
- Specs `product-identity` ("Brand mark") and `app-shell` ("App icon") describe the Cursor Signal; the stale "dark gradient with a soft amber glow" goes.
- Out of scope (#495): the copies of the geometry drawn by hand in the app header, the site, the macOS and Windows tray glyphs and the setup banner.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `product-identity`: "Brand mark".
- `app-shell`: "App icon".

## Impact

- `apps/mobile/scripts/icons.mts` and its outputs under `apps/mobile/assets/`, `apps/mobile/store/`, `apps/daemon/tray/linux/remote-harness-symbolic.svg`, `docs/brand/og.png`; `docs/design/identity/{shared.js,icons.html,branding/*,screens/*}`. The daemon copies `assets/icon.png` for its macOS bundle, so the bundle icon follows on the next `remote-harness install`.
- Native assets change (app icon, splash, notification icon): a store build is needed for them to reach users; the JavaScript side is unchanged.
