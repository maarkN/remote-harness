## Why

Transcript images look blurry in the full-screen viewer and pinch zoom only magnifies the blur (issue #476). The daemon sends the original bytes; the loss is on the phone: `ImageViewer` renders the image in a React Native `Image` the size of the stage and zooms it with a transform, and React Native decodes an image to the size of its view (on iOS always, through the image loader's target size), so the bitmap under a 5× zoom has the screen's pixels, not the image's.

## What Changes

- **The viewer decodes the image whole.** It measures the image (`Image.getSize`) and the stage, gives the image a view of its own pixel size in points (pixels ÷ pixel ratio), capped at about 16 megapixels so a huge image cannot exhaust memory, and fits it to the stage with a base scale that pinch zoom multiplies. Gestures, double tap, close and accessibility are unchanged; until the size is known the image is laid out as before.
- Pure helper `fitImage()` in `features/images/fit.ts`, with tests.
- No native dependency (`expo-image` was the alternative): the existing viewer and the store builds stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-conversation`: the full-screen viewer shows the image at its own resolution, within a memory cap.

## Impact

`apps/mobile/src/features/images` (`ImageViewer.tsx`, `fit.ts` with tests). Thumbnails (`ImageStrip`) already decode at the screen's pixel density for their 160 × 120 box and are unchanged. No protocol, daemon or i18n change.
