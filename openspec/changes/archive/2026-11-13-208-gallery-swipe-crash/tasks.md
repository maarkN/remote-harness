## 1. Gallery helpers

- [x] 1.1 Test first in `gallery.test.ts`: `swipeTarget`, `nextIndex` and `previousIndex` carry the `'worklet'` directive; verify it fails on the current helpers
- [x] 1.2 Add the directive to the three helpers in `features/images/gallery.ts`; verify `gallery.test.ts` passes and the iOS bundle (`npx expo export --platform ios`) workletizes `swipeTarget` (its compiled code carries the worklet hash)
- [x] 1.3 Review the other gesture callbacks of `ImageViewer.tsx` for synchronous calls to non-worklet functions; verify none is left

## 2. Verification

- [x] 2.1 `pnpm check` green
- [x] 2.2 In a release build on the iOS simulator: at 1× a swipe changes the image in both directions, stops at the first and last image, a short swipe snaps back and panning a zoomed image still works (iPhone 17 Pro Max, iOS 26.5: every swipe checked with the app running throughout; the zoomed pan was not exercised, the simulator's synthetic double tap does not zoom, and that path is unchanged)
- [ ] 2.3 The same on an Android release build
