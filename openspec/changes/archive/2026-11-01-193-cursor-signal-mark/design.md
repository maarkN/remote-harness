## Context

`icons.mts` holds the Tether's geometry (`MARK`: ring, stem, reins, nodes, in two weights) and composes every asset from `mark()`/`markAt()`; the prototype sprite in `docs/design/identity/shared.js` repeats the same geometry for the HTML pages. The designer's `icon.svg` (256 box) is the reference for the new mark; it cuts the prompt out of the block with an SVG mask. See proposal.md for the motivation.

## Goals / Non-Goals

- Goals: one geometry in the script and the sprite, pixel-faithful to the designer's SVG at the icon size; every generated asset follows; the small sizes stay legible.
- Non-goals: the hand-drawn copies (#495); new asset types; changing the banner's composition.

## Decisions

- **Mask for the cutout, as the designer drew it.** The `>` is a round stroke painted black into a mask over the block, which keeps the block's rounded corners intact and the cutout's round caps; librsvg (sharp) renders masks. Each `mark()` gets its own mask id so a document with several marks (the sheet) stays valid.
- **Bold weight kept**: cutout 24 and arcs 28 (regular: 16 and 22). At 22 px the arcs are about 2.4 px thick with 1 px gaps and the cutout about 2 px: visible, where the regular weight's cutout closed up. Checked by rendering the notification, favicon, Live Activity and symbolic outputs and inspecting them.
- **Flat container `#1C1A17`** (the existing `BG_TOP`, now `CONTAINER`) for the app icon, the per-theme icons (their own flat colors) and the Live Activity icon; the banner and the feature graphic keep their dark gradient (no glow, as before). The favicon gets the 22 % rounded corners and a transparent outside, since browsers show the PNG as is; iOS and Android mask their icons.
- **Sources committed**: the designer's four SVGs and the concept sheet under `docs/design/identity/branding/`; the script also writes normalized 256-box variants to `assets/icon/`.
- **Sprite CSS variables**: `--cutout` (painted `#fff` fills the block solid: the tray "working" state proposed in #495) and `--block`, replacing the Tether's `--ring` and `--n-*`.

## Risks / Trade-offs

- [Three thin arcs at 16–22 px blur into one] → the bold weight; the Linux symbolic and the favicon are inspected at size in this change, the menu bar glyph in #495.
- [A native asset change needs a store build] → stated in the release notes; OTA keeps shipping the JavaScript.
