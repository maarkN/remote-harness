## Context

Four renderers hold their own copy of the Tether: `Mark.tsx` (react-native-svg), `site.ts` (inline SVG strings for the landing, the install link page and the favicon), `Tray.swift` (an `NSImage` drawn with `NSBezierPath`, template when not colored) and `Tray.cs` (GDI+ into an `Icon`), plus the banner's block-character art. The Cursor Signal needs a hole (the prompt) in a filled shape, which each renderer does its own way. See proposal.md for the motivation.

## Goals / Non-Goals

- Goals: one geometry everywhere, including the cutout; tray states readable without the ring; banner within 80 columns with a test.
- Non-goals: generating the Swift and C# drawing code from the script (the geometry is six numbers and three arcs; a comment names the source); a new popover design.

## Decisions

- **The cutout per renderer**: SVG mask in the app and on the web (luminance mask, white block, black prompt stroke; react-native-svg supports `Mask` on both platforms and the web is plain SVG); on macOS the block is filled and the prompt stroked with `destinationOut`, which erases to transparent in the template image; on Windows the prompt is a transparent pen in `SourceCopy` mode, which overwrites the block's pixels. The arcs are plain strokes in all four.
- **State mapping** as proposed in #495: `working` skips the cutout (solid block), `waiting` keeps the amber dot but moves it to the outer arc's upper end, `offline` is 40 % opacity on both platforms (macOS gained it; Windows already had it), `idle` the plain glyph. Color never encodes state except the dot.
- **Named colors in `Mark.tsx`** (`white`, `black`) for the mask, since the theme test forbids hex outside `core/theme`.
- **Banner art**: 14 columns, 9 rows; the block is five `█` columns with the prompt carved by half blocks and spaces, the arcs are single columns staggered like `)))`. `BANNER_WIDTH` is unchanged (77), and a test pins every logo line under 80 columns.
- **Prototype sprite variable** `--cutout: #fff` (from #494) renders the working state in the HTML pages; the four pages that used `--ring` switch to it and the three screens are re-exported.

## Risks / Trade-offs

- [The Windows helper cannot be compiled here] → the change is small and mirrors the Swift one; the Swift file is type-checked with `swiftc`.
- [`destinationOut` on a template image] → the erased area is transparent, which is what a template needs; the dot is drawn after, in `sourceOver`.
