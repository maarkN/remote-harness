## Why

Swiping left or right in the image viewer (a message with two or more images, at 1×) closes the app on iOS in a release build (#541); the Next button and the thumbnail strip change images fine. The crash report shows `EXC_CRASH (SIGABRT)` on the main thread from `HermesRuntimeImpl::throwPendingError` ← `worklets::WorkletRuntime::runSync` ← `reanimated::UIEventHandler::process`: a JS error thrown inside a gesture worklet on the UI runtime.

Cause, from the code: the Pan gesture's `onEnd` in `features/images/ImageViewer.tsx` runs on the UI runtime and calls `swipeTarget` from `features/images/gallery.ts`, which calls `nextIndex` / `previousIndex`. None of the three is a worklet: the worklets Babel plugin turns the gesture callbacks themselves into worklets, but a function imported from another module stays a plain JS function unless it carries the `'worklet'` directive, and calling a plain JS function synchronously from the UI runtime throws. A development build reports the error; a release build aborts. The other gesture callbacks are clean: `reset` is already a worklet, `go` and `onClose` are reached through `scheduleOnRN`, and the rest only touch shared values, `Math` and `withTiming`.

## What Changes

- `swipeTarget`, `nextIndex` and `previousIndex` become worklets (`'worklet'` directive), so the Pan gesture works the target out on the UI runtime without crossing to the JS thread. They stay plain functions on the JS thread too (the Previous / Next buttons call them), still covered by `gallery.test.ts`.
- A test guards the directive on the three helpers, so a future helper called from a gesture without it fails a test instead of a release build.
- The viewer's other gesture callbacks are reviewed for calls to non-worklet functions (none found; noted above).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-conversation`: "Images in the conversation" says a swipe never closes the app, with a release-build swipe scenario across the ends of the gallery.

## Impact

- App: `features/images/gallery.ts` and `gallery.test.ts`. No daemon, protocol or UI text change.
