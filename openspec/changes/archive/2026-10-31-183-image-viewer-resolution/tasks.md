## 1. Viewer

- [x] 1.1 `fitImage()` in `features/images/fit.ts`: view size in points from the image pixels and the pixel ratio, 16-megapixel cap, base scale that fits the stage; tests
- [x] 1.2 `ImageViewer` measures the image and the stage, sizes the image view from `fitImage()` and multiplies the base scale into the zoom transform; falls back to the stage size until measured

## 2. Verification

- [x] 2.1 App typecheck, tests and Biome; still to try on a device: a screenshot from a tool result zoomed to 5× stays sharp, a 5 MB PNG opens on the floor devices without a crash
