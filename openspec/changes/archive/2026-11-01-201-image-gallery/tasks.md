## 1. Logic

- [x] 1.1 `images/gallery.ts`: `nextIndex`, `previousIndex`, `swipeTarget` (distance or velocity, clamped); tests

## 2. Viewer

- [x] 2.1 `ImageViewer` takes the message's images and a start index: swipe at 1× (pan stays for zoom), zoom reset on change, counter, Previous / Next buttons, thumbnail strip (hidden with one image) on the transcript image cache
- [x] 2.2 `ImageStrip` opens the viewer with the whole message; i18n pt-BR, en-US, es-ES

## 3. Verify

- [x] 3.1 `turbo run typecheck test`, Biome, `expo export --platform ios`
