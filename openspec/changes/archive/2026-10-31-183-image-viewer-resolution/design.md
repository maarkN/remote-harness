## Context

React Native's `Image` asks the platform to decode a bitmap of the view's size (times the pixel ratio); a transform scales that bitmap. The viewer's image view is the stage, so zooming 5× shows each decoded pixel 5× larger. The images are base64 data URIs from the history cache or `transcript.image`, at most 5 MB.

## Goals / Non-Goals

**Goals:** zoom sharp up to the image's own pixels; no crash with a 5 MB image on the floor devices; no change to gestures or to the builds.

**Non-Goals:** a new image library, progressive or tiled rendering, changes to the thumbnails.

## Decisions

- **Size the view, not the library.** `Image.getSize` gives the image's pixels; the view gets that size in points (pixels ÷ `PixelRatio.get()`) so the decode target is the whole image, and a base scale (contain) fits it to the stage. Zoom multiplies the base scale in the same transform, so the pan math is unchanged (translations stay in stage points: the transform lists translate before scale).
- **Pixel cap.** Above 16 megapixels (about 64 MB of RGBA) the view is scaled down by `sqrt(cap / pixels)`, keeping the aspect ratio: the iPad 9th gen and the Redmi 8 (3 GB) stay safe, and a 5 MB image rarely has more pixels than that.
- **No `expo-image`.** `allowDownscaling={false}` would decode whole too, but adds a native module to every build for one screen, and has no pixel cap.
- **Before the size is known** the image keeps the stage's size, as today; the layout is pure (`fitImage`) and tested, the component only renders what it returns.

## Risks / Trade-offs

- [More memory per open image] → one viewer at a time, capped at 16 MP; thumbnails unchanged.
- [`Image.getSize` fails for an unusual data URI] → the viewer falls back to today's layout.
